import fs from 'fs';
import path from 'path';
import {
  Card,
  HandGroups,
  Player,
  TableState,
  TableStatus,
  TrickPlay,
  TrickResult,
  DetailedRoundRecord,
  PlayerRoundRecord,
} from '../src/core/hazari/types';
import { shuffleAndDeal } from '../src/core/hazari/deck';
import { evaluate3CardGroup, evaluateExtraGroup } from '../src/core/hazari/evaluator';
import { arrangeAgentHand, createAgentPlayer, getRandomAgentName } from '../src/core/hazari/ai';
import { resolveTrick, checkGameWinner } from '../src/core/hazari/rules';
import { findOptimalArrangement, validateArrangement, ArrangementStrategy } from '../src/core/hazari/arranger';
import { extractFeatures } from '../src/core/hazari/features';

export interface InternalPlayerHand {
  dealtCards: Card[];
  arrangedGroups: HandGroups | null;
  isReady: boolean;
}

export interface TableChatMessage {
  id: string;
  tableId: string;
  senderId: string;
  senderName: string;
  seatIndex: number | null; // null for spectator
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isAgent?: boolean;
}

export class TableInstance {
  public state: TableState;
  // Private server-only hand data (hidden from clients until played)
  public playerHands: Map<number, InternalPlayerHand> = new Map();
  public playerStrategies: Map<number, ArrangementStrategy> = new Map();
  public chatMessages: TableChatMessage[] = [];
  private timerRef: NodeJS.Timeout | null = null;
  private onStateChangeCallback: (state: TableState, privateHands: Map<number, InternalPlayerHand>) => void;
  private onGameFinishedCallback?: (
    state: TableState,
    winnerSeat: number,
    hands: Map<number, InternalPlayerHand>,
    strategies: Map<number, ArrangementStrategy>
  ) => void;
  private persistenceFilePath: string;

  constructor(
    tableId: string,
    tableName: string,
    onStateChange: (state: TableState, privateHands: Map<number, InternalPlayerHand>) => void,
    onGameFinished?: (
      state: TableState,
      winnerSeat: number,
      hands: Map<number, InternalPlayerHand>,
      strategies: Map<number, ArrangementStrategy>
    ) => void
  ) {
    this.persistenceFilePath = path.join(process.cwd(), 'data', `.hazari_table_${tableId}.json`);
    this.onStateChangeCallback = onStateChange;
    this.onGameFinishedCallback = onGameFinished;

    // Initialize 4 seats with AI agents with dynamic random names
    const usedNames = new Set<string>();
    const players: Player[] = [
      createAgentPlayer(0, getRandomAgentName(0, usedNames)),
      createAgentPlayer(1, getRandomAgentName(1, usedNames)),
      createAgentPlayer(2, getRandomAgentName(2, usedNames)),
      createAgentPlayer(3, getRandomAgentName(3, usedNames)),
    ];

    this.state = {
      tableId,
      tableName,
      status: 'WAITING',
      players,
      dealerSeat: 0,
      leadSeat: 0,
      currentTurnSeat: 0,
      currentRound: 1,
      currentTrick: 1,
      currentTrickPlays: [],
      tricksHistory: [],
      roundsHistory: [],
      trainingSamples: [],
      targetScore: 1000,
      gameWinnerSeat: null,
      lastActionMessage: 'Table created. Waiting to start deal.',
      updatedAt: Date.now(),
    };

    // Attempt to recover saved state
    this.loadPersistedState();
  }

  private savePersistedState() {
    try {
      const dir = path.dirname(this.persistenceFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        state: this.state,
        hands: Array.from(this.playerHands.entries()),
      };
      fs.writeFileSync(this.persistenceFilePath, JSON.stringify(data), 'utf8');
    } catch {}
  }

  private loadPersistedState() {
    try {
      if (fs.existsSync(this.persistenceFilePath)) {
        const raw = fs.readFileSync(this.persistenceFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.state) {
          this.state = parsed.state;
          if (Array.isArray(parsed.hands)) {
            this.playerHands = new Map(parsed.hands);
          }
        }
      }
    } catch {}
  }

  private notify() {
    this.state.updatedAt = Date.now();
    this.savePersistedState();
    this.onStateChangeCallback(this.state, this.playerHands);
  }

  public joinTable(
    userId: string,
    userName: string,
    socketId: string,
    preferredSeat?: number
  ): { success: boolean; seatIndex: number; error?: string } {
    const existingIndex = this.state.players.findIndex((p) => p.id === userId);
    if (existingIndex !== -1) {
      const p = this.state.players[existingIndex];
      p.connected = true;
      p.socketId = socketId;
      p.disconnectedAt = null;
      p.reconnectGraceExpiresAt = null;
      this.state.lastActionMessage = `${userName} reconnected to Seat ${existingIndex + 1}.`;
      this.notify();
      return { success: true, seatIndex: existingIndex };
    }

    let targetSeat = -1;
    if (
      preferredSeat !== undefined &&
      preferredSeat >= 0 &&
      preferredSeat < 4 &&
      this.state.players[preferredSeat].isAgent
    ) {
      targetSeat = preferredSeat;
    } else {
      targetSeat = this.state.players.findIndex((p) => p.isAgent);
    }

    if (targetSeat === -1) {
      return { success: false, seatIndex: -1, error: 'Table is full with 4 human players.' };
    }

    const prevPlayer = this.state.players[targetSeat];
    const newPlayer: Player = {
      id: userId,
      name: userName,
      avatar: '👤',
      seatIndex: targetSeat,
      isAgent: false,
      connected: true,
      socketId,
      cumulativeScore: prevPlayer.cumulativeScore,
      roundScore: prevPlayer.roundScore,
      isReady: prevPlayer.isReady,
      hasPlayedCurrentTrick: prevPlayer.hasPlayedCurrentTrick,
    };

    this.state.players[targetSeat] = newPlayer;
    this.state.lastActionMessage = `${userName} joined the table at Seat ${targetSeat + 1}.`;
    this.notify();

    if (this.state.status === 'WAITING') {
      this.startDeal();
    }

    return { success: true, seatIndex: targetSeat };
  }

  public handlePlayerDisconnect(socketId: string) {
    const seatIndex = this.state.players.findIndex((p) => p.socketId === socketId && !p.isAgent);
    if (seatIndex === -1) return;

    const player = this.state.players[seatIndex];
    player.connected = false;
    player.disconnectedAt = Date.now();
    player.reconnectGraceExpiresAt = Date.now() + 15000;

    this.state.lastActionMessage = `${player.name} disconnected. AI Agent taking over to prevent game stall.`;
    this.notify();

    if (this.state.status === 'ARRANGING') {
      const hand = this.playerHands.get(seatIndex);
      if (hand && !hand.isReady) {
        const agentArr = arrangeAgentHand(hand.dealtCards, seatIndex);
        hand.arrangedGroups = agentArr.groups;
        hand.isReady = true;
        player.isReady = true;
        this.playerStrategies.set(seatIndex, agentArr.strategyUsed);
        this.checkAllArranged();
      }
    } else if (this.state.status === 'PLAYING_TRICK' && this.state.currentTurnSeat === seatIndex) {
      setTimeout(() => this.executeAgentPlay(seatIndex), 1000);
    }
  }

  public leaveSeat(userId: string): boolean {
    const seatIndex = this.state.players.findIndex((p) => p.id === userId);
    if (seatIndex === -1) return false;

    const prev = this.state.players[seatIndex];
    const agent = createAgentPlayer(seatIndex, getRandomAgentName(seatIndex));
    agent.cumulativeScore = prev.cumulativeScore;
    agent.roundScore = prev.roundScore;
    agent.isReady = prev.isReady;
    agent.hasPlayedCurrentTrick = prev.hasPlayedCurrentTrick;

    this.state.players[seatIndex] = agent;
    this.state.lastActionMessage = `${prev.name} left. ${agent.name} took over Seat ${seatIndex + 1}.`;
    this.notify();

    // When the last user leaves and all seats are now AI agents, finish the tournament with AI agents and auto-complete
    const hasAnyHuman = this.state.players.some((p) => !p.isAgent);
    if (!hasAnyHuman) {
      this.state.lastActionMessage = 'All human players have left. Completing tournament with AI agents...';
      this.notify();
      setTimeout(() => {
        this.finishGameWithAllAgents();
      }, 500);
      return true;
    }

    if (this.state.status === 'ARRANGING' && !agent.isReady) {
      const hand = this.playerHands.get(seatIndex);
      if (hand) {
        const agentArr = arrangeAgentHand(hand.dealtCards, seatIndex);
        hand.arrangedGroups = agentArr.groups;
        hand.isReady = true;
        agent.isReady = true;
        this.playerStrategies.set(seatIndex, agentArr.strategyUsed);
        this.checkAllArranged();
      }
    } else if (this.state.status === 'PLAYING_TRICK' && this.state.currentTurnSeat === seatIndex) {
      setTimeout(() => this.executeAgentPlay(seatIndex), 800);
    }

    return true;
  }

  public startDeal() {
    if (this.state.status === 'DEALING') return;

    this.state.status = 'DEALING';
    this.state.currentTrick = 1;
    this.state.currentTrickPlays = [];
    this.state.tricksHistory = [];
    this.state.players.forEach((p) => {
      p.roundScore = 0;
      p.isReady = false;
      p.hasPlayedCurrentTrick = false;
    });

    this.state.lastActionMessage = `Round ${this.state.currentRound}: Dealing 13 cards to all 4 players...`;
    this.notify();

    const dealtDecks = shuffleAndDeal();
    for (let seat = 0; seat < 4; seat++) {
      this.playerHands.set(seat, {
        dealtCards: dealtDecks[seat],
        arrangedGroups: null,
        isReady: false,
      });
    }

    setTimeout(() => {
      this.state.status = 'ARRANGING';
      this.state.lastActionMessage = 'Arrange your 13 cards into 3, 3, 3, and 4. Declare "Up" when ready!';
      this.notify();

      // Automatically arrange cards for all AI bots with distinct persona strategies
      this.state.players.forEach((p, seat) => {
        if (p.isAgent) {
          setTimeout(() => {
            const hand = this.playerHands.get(seat);
            if (hand && !hand.isReady) {
              const agentArr = arrangeAgentHand(hand.dealtCards, seat);
              hand.arrangedGroups = agentArr.groups;
              hand.isReady = true;
              p.isReady = true;
              this.playerStrategies.set(seat, agentArr.strategyUsed);
              this.notify();
              this.checkAllArranged();
            }
          }, 600 + seat * 350);
        }
      });
    }, 1500);
  }

  public submitArrangement(
    seatIndex: number,
    groups: HandGroups,
    strategy: ArrangementStrategy = 'optimal_ev'
  ): { success: boolean; error?: string } {
    if (this.state.status !== 'ARRANGING') {
      return { success: false, error: 'Table is not in arrangement phase.' };
    }

    const validation = validateArrangement(groups);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const hand = this.playerHands.get(seatIndex);
    if (!hand) {
      return { success: false, error: 'Player hand not found.' };
    }

    hand.arrangedGroups = groups;
    hand.isReady = true;
    this.state.players[seatIndex].isReady = true;
    this.playerStrategies.set(seatIndex, strategy);
    this.state.lastActionMessage = `${this.state.players[seatIndex].name} declared "Up" (Ready)!`;
    this.notify();

    this.checkAllArranged();
    return { success: true };
  }

  private checkAllArranged() {
    const allReady = this.state.players.every((p) => p.isReady);
    if (!allReady) return;

    this.state.status = 'PLAYING_TRICK';
    this.state.currentTrick = 1;
    this.state.currentTrickPlays = [];
    this.state.players.forEach((p) => {
      p.hasPlayedCurrentTrick = false;
    });

    this.state.currentTurnSeat = this.state.leadSeat;
    this.state.lastActionMessage = `Trick 1: ${this.state.players[this.state.leadSeat].name} leads the round.`;
    this.notify();

    if (this.state.players[this.state.currentTurnSeat].isAgent) {
      setTimeout(() => this.executeAgentPlay(this.state.currentTurnSeat), 1000);
    }
  }

  public playTrick(seatIndex: number): { success: boolean; error?: string } {
    if (this.state.status !== 'PLAYING_TRICK') {
      return { success: false, error: 'Table is not accepting trick plays right now.' };
    }

    if (this.state.currentTurnSeat !== seatIndex) {
      return { success: false, error: `It is not your turn to play (Current turn: Seat ${this.state.currentTurnSeat + 1}).` };
    }

    const player = this.state.players[seatIndex];
    const hand = this.playerHands.get(seatIndex);
    if (!hand || !hand.arrangedGroups) {
      return { success: false, error: 'Arranged hand missing.' };
    }

    const trickNum = this.state.currentTrick;
    let cardsToPlay: Card[];
    if (trickNum === 1) cardsToPlay = hand.arrangedGroups.group1;
    else if (trickNum === 2) cardsToPlay = hand.arrangedGroups.group2;
    else if (trickNum === 3) cardsToPlay = hand.arrangedGroups.group3;
    else cardsToPlay = hand.arrangedGroups.group4;

    const evaluation = cardsToPlay.length === 3 ? evaluate3CardGroup(cardsToPlay) : evaluateExtraGroup(cardsToPlay);
    const points = cardsToPlay.reduce((sum, c) => sum + c.points, 0);

    const play: TrickPlay = {
      playerId: player.id,
      playerName: player.name,
      seatIndex,
      isAgent: player.isAgent,
      cards: cardsToPlay,
      evaluation,
      points,
      playOrder: this.state.currentTrickPlays.length,
    };

    this.state.currentTrickPlays.push(play);
    player.hasPlayedCurrentTrick = true;
    this.state.lastActionMessage = `${player.name} played ${cardsToPlay.map((c) => c.code).join(' ')} (${evaluation.categoryName}, ${points} pts).`;
    this.notify();

    if (this.state.currentTrickPlays.length === 4) {
      this.resolveCurrentTrick();
    } else {
      this.state.currentTurnSeat = (seatIndex + 1) % 4;
      this.notify();

      const nextPlayer = this.state.players[this.state.currentTurnSeat];
      if (nextPlayer.isAgent || !nextPlayer.connected) {
        setTimeout(() => this.executeAgentPlay(this.state.currentTurnSeat), 900);
      }
    }

    return { success: true };
  }

  private executeAgentPlay(seatIndex: number) {
    if (this.state.status === 'PLAYING_TRICK' && this.state.currentTurnSeat === seatIndex) {
      this.playTrick(seatIndex);
    }
  }

  private resolveCurrentTrick() {
    this.state.status = 'TRICK_RESOLVED';
    const result = resolveTrick(this.state.currentTrick, this.state.currentTrickPlays);
    this.state.tricksHistory.push(result);

    const winner = this.state.players[result.winnerSeatIndex];
    winner.roundScore += result.pointsAwarded;
    this.state.leadSeat = result.winnerSeatIndex;

    this.state.lastActionMessage = `🏆 ${result.winnerName} wins Trick ${this.state.currentTrick}! (+${result.pointsAwarded} points)`;
    this.notify();

    setTimeout(() => {
      if (this.state.currentTrick < 4) {
        this.state.currentTrick += 1;
        this.state.currentTrickPlays = [];
        this.state.players.forEach((p) => {
          p.hasPlayedCurrentTrick = false;
        });
        this.state.status = 'PLAYING_TRICK';
        this.state.currentTurnSeat = this.state.leadSeat;
        this.state.lastActionMessage = `Trick ${this.state.currentTrick}: ${this.state.players[this.state.leadSeat].name} leads.`;
        this.notify();

        if (this.state.players[this.state.currentTurnSeat].isAgent) {
          setTimeout(() => this.executeAgentPlay(this.state.currentTurnSeat), 1000);
        }
      } else {
        this.finalizeRound();
      }
    }, 2800);
  }

  private finalizeRound() {
    this.state.status = 'ROUND_SUMMARY';
    this.state.players.forEach((p) => {
      p.cumulativeScore += p.roundScore;
    });

    const cumulativeScores = this.state.players.map((p) => p.cumulativeScore);
    const winCheck = checkGameWinner(cumulativeScores, this.state.targetScore);

    // Identify round winner (highest points won this round)
    let bestRoundWinnerSeat = 0;
    let maxRoundScore = -1;
    this.state.players.forEach((p, idx) => {
      if (p.roundScore > maxRoundScore) {
        maxRoundScore = p.roundScore;
        bestRoundWinnerSeat = idx;
      }
    });

    const effectiveWinnerSeat = winCheck.isGameOver && winCheck.winnerSeatIndex !== null
      ? winCheck.winnerSeatIndex
      : bestRoundWinnerSeat;

    // Requirement 4: Record every single round's scores, winning hand, ML vectors, and strategies
    const roundTrainingSamples = this.state.players.map((p, idx) => {
      const hand = this.playerHands.get(idx);
      const feat = hand ? extractFeatures(hand.dealtCards).normalizedVector : [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const strat = this.playerStrategies.get(idx) || (idx === bestRoundWinnerSeat ? 'optimal_ev' : 'balanced');
      return {
        features: feat,
        winningStrategy: strat,
        score: p.roundScore,
        playerId: p.id,
        playerName: p.name,
        roundNumber: this.state.currentRound,
      };
    });

    const winningTricks = this.state.tricksHistory.filter((t) => t.winnerSeatIndex === bestRoundWinnerSeat);
    const winningHandSummary = winningTricks.length > 0
      ? winningTricks.map((t) => `Trick ${t.trickNumber}: ${t.winningCards.map((c) => c.code).join(' ')} (+${t.pointsAwarded} pts)`).join(' | ')
      : `${this.state.players[bestRoundWinnerSeat].name} took round (+${maxRoundScore} pts)`;

    const playerDetails: PlayerRoundRecord[] = this.state.players.map((p, idx) => {
      const hand = this.playerHands.get(idx);
      const feat = hand ? extractFeatures(hand.dealtCards).normalizedVector : [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      return {
        playerId: p.id,
        playerName: p.name,
        isAgent: p.isAgent,
        seatIndex: idx,
        roundScore: p.roundScore,
        cumulativeScore: p.cumulativeScore,
        strategyUsed: this.playerStrategies.get(idx) || 'balanced',
        features: feat,
        cardsArranged: hand ? hand.arrangedGroups : null,
      };
    });

    const roundRecord: DetailedRoundRecord = {
      roundNumber: this.state.currentRound,
      winnerSeat: bestRoundWinnerSeat,
      winnerName: this.state.players[bestRoundWinnerSeat].name,
      pointsAwarded: maxRoundScore,
      winningHand: winningHandSummary,
      playerScores: this.state.players.map((p) => ({
        playerName: p.name,
        roundScore: p.roundScore,
        cumulativeScore: p.cumulativeScore,
      })),
      playerDetails,
      tricks: [...this.state.tricksHistory],
      trainingSamples: roundTrainingSamples,
    };

    if (!this.state.roundsHistory) this.state.roundsHistory = [];
    this.state.roundsHistory.push(roundRecord);

    if (!this.state.trainingSamples) this.state.trainingSamples = [];
    this.state.trainingSamples.push(...roundTrainingSamples);

    // Send data to sequential machine learning pipeline!
    if (this.onGameFinishedCallback) {
      this.onGameFinishedCallback(this.state, effectiveWinnerSeat, this.playerHands, this.playerStrategies);
    }

    if (winCheck.isGameOver && winCheck.winnerSeatIndex !== null) {
      this.state.status = 'GAME_OVER';
      this.state.gameWinnerSeat = winCheck.winnerSeatIndex;
      if (!this.state.seatWins) this.state.seatWins = [0, 0, 0, 0];
      this.state.seatWins[winCheck.winnerSeatIndex] = (this.state.seatWins[winCheck.winnerSeatIndex] || 0) + 1;

      const champion = this.state.players[winCheck.winnerSeatIndex];
      this.state.lastActionMessage = `🎉 GAME OVER! ${champion.name} reaches ${champion.cumulativeScore} points and wins the 1000-point Hazari Tournament!`;
      this.notify();

      // Requirement 5: If all players are agents and an agent won, auto-complete the game!
      const hasRealUser = this.state.players.some((p) => !p.isAgent);
      if (!hasRealUser) {
        setTimeout(() => {
          this.completeGame('system_agent_bot');
        }, 1200);
      }
    } else {
      this.state.lastActionMessage = `Round ${this.state.currentRound} complete. Winner: ${this.state.players[bestRoundWinnerSeat].name} (+${maxRoundScore} pts). Next deal starting...`;
      this.notify();

      setTimeout(() => {
        this.state.currentRound += 1;
        this.startDeal();
      }, 4500);
    }
  }

  public completeGame(closedByUserId: string): { success: boolean } {
    if (this.state.status === 'COMPLETED_CLOSED') {
      return { success: true };
    }
    // Requirement 7: before completing a game the model would be train on the single game data
    if (this.onGameFinishedCallback) {
      const winnerSeat = this.state.gameWinnerSeat ?? 0;
      this.onGameFinishedCallback(this.state, winnerSeat, this.playerHands, this.playerStrategies);
    }

    this.state.status = 'COMPLETED_CLOSED';
    this.state.lastActionMessage = 'Game completed and closed. Archived to tournament history.';
    this.notify();
    this.savePersistedState();
    return { success: true };
  }

  public shuffleTable() {
    this.state.currentRound = 1;
    this.state.gameWinnerSeat = null;
    this.state.roundsHistory = [];
    this.state.trainingSamples = [];
    this.state.players.forEach((p) => {
      p.cumulativeScore = 0;
      p.roundScore = 0;
      p.isReady = false;
      p.hasPlayedCurrentTrick = false;
    });
    this.state.lastActionMessage = 'Table reset. Starting new 1000-point championship!';
    this.startDeal();
  }

  public getClientView(seatIndex: number): { tableState: TableState; localHand: InternalPlayerHand | null } {
    return {
      tableState: this.state,
      localHand: this.playerHands.get(seatIndex) || null,
    };
  }

  /**
   * Requirement: When the last user left for more than 30 min, replace seat with an agent
   * and complete gameplay with all agents, then declare winner and auto-complete after round.
   * If more than 1 user and all are out for > 30 min, replace all of them with agents and auto-complete.
   * If table has all open seats and all agents, finish the game with AI agents.
   */
  public checkAbandonedGameTimeout(timeoutMs: number = 30 * 60 * 1000): {
    timedOut: boolean;
    replacedSeats: number[];
  } {
    if (this.state.status === 'COMPLETED_CLOSED') {
      return { timedOut: false, replacedSeats: [] };
    }

    const now = Date.now();
    const replacedSeats: number[] = [];

    // Find human players who are disconnected for >= timeoutMs
    this.state.players.forEach((player, seatIndex) => {
      if (!player.isAgent) {
        const isDisconnectedTimeout =
          !player.connected &&
          player.disconnectedAt &&
          now - player.disconnectedAt >= timeoutMs;

        if (isDisconnectedTimeout) {
          const agent = createAgentPlayer(seatIndex, getRandomAgentName(seatIndex));
          agent.cumulativeScore = player.cumulativeScore;
          agent.roundScore = player.roundScore;
          agent.isReady = player.isReady;
          agent.hasPlayedCurrentTrick = player.hasPlayedCurrentTrick;

          this.state.players[seatIndex] = agent;
          replacedSeats.push(seatIndex);
          this.state.lastActionMessage = `Seat ${seatIndex + 1} (${player.name}) inactive > 30m. Replaced by ${agent.name}.`;
        }
      }
    });

    if (replacedSeats.length > 0) {
      this.notify();
      this.savePersistedState();
    }

    // Check if table now has ALL 4 players as AI agents
    const remainingHumans = this.state.players.filter((p) => !p.isAgent);
    if (remainingHumans.length === 0) {
      this.finishGameWithAllAgents();
      return { timedOut: true, replacedSeats };
    }

    return { timedOut: false, replacedSeats };
  }

  private startDealSync() {
    this.state.status = 'ARRANGING';
    this.state.currentTrick = 1;
    this.state.currentTrickPlays = [];
    this.state.tricksHistory = [];
    this.state.players.forEach((p) => {
      p.roundScore = 0;
      p.isReady = false;
      p.hasPlayedCurrentTrick = false;
    });

    const dealtDecks = shuffleAndDeal();
    for (let seat = 0; seat < 4; seat++) {
      this.playerHands.set(seat, {
        dealtCards: dealtDecks[seat],
        arrangedGroups: null,
        isReady: false,
      });
      const agentArr = arrangeAgentHand(dealtDecks[seat], seat);
      const hand = this.playerHands.get(seat)!;
      hand.arrangedGroups = agentArr.groups;
      hand.isReady = true;
      this.state.players[seat].isReady = true;
      this.playerStrategies.set(seat, agentArr.strategyUsed);
    }
  }

  public finishGameWithAllAgents() {
    if (this.state.status === 'COMPLETED_CLOSED') return;

    this.state.lastActionMessage = 'All players inactive for > 30 min. Running tournament to completion with AI agents...';
    this.notify();

    // Ensure all 4 seats are AI agents
    this.state.players.forEach((p, idx) => {
      if (!p.isAgent) {
        const agent = createAgentPlayer(idx, getRandomAgentName(idx));
        agent.cumulativeScore = p.cumulativeScore;
        agent.roundScore = p.roundScore;
        agent.isReady = true;
        this.state.players[idx] = agent;
      }
    });

    let maxSafetyRounds = 30;
    while (
      (this.state.status as string) !== 'COMPLETED_CLOSED' &&
      (this.state.status as string) !== 'GAME_OVER' &&
      maxSafetyRounds > 0
    ) {
      maxSafetyRounds--;

      if (
        this.state.status === 'WAITING' ||
        this.state.status === 'DEALING' ||
        this.state.status === 'ROUND_SUMMARY'
      ) {
        this.startDealSync();
      }

      if (this.state.status === 'ARRANGING') {
        for (let seat = 0; seat < 4; seat++) {
          const hand = this.playerHands.get(seat);
          if (hand && !hand.isReady) {
            const arr = arrangeAgentHand(hand.dealtCards, seat);
            hand.arrangedGroups = arr.groups;
            hand.isReady = true;
            this.state.players[seat].isReady = true;
            this.playerStrategies.set(seat, arr.strategyUsed);
          }
        }
        this.state.status = 'PLAYING_TRICK';
        this.state.currentTrick = 1;
        this.state.currentTrickPlays = [];
        this.state.currentTurnSeat = this.state.leadSeat;
      }

      // Play through all 4 tricks of this round
      while (this.state.status === 'PLAYING_TRICK' && this.state.currentTrick <= 4) {
        while (this.state.currentTrickPlays.length < 4) {
          const seat = this.state.currentTurnSeat;
          const player = this.state.players[seat];
          const hand = this.playerHands.get(seat);
          if (!hand || !hand.arrangedGroups) break;

          let cardsToPlay: Card[];
          if (this.state.currentTrick === 1) cardsToPlay = hand.arrangedGroups.group1;
          else if (this.state.currentTrick === 2) cardsToPlay = hand.arrangedGroups.group2;
          else if (this.state.currentTrick === 3) cardsToPlay = hand.arrangedGroups.group3;
          else cardsToPlay = hand.arrangedGroups.group4;

          const evaluation =
            cardsToPlay.length === 3
              ? evaluate3CardGroup(cardsToPlay)
              : evaluateExtraGroup(cardsToPlay);
          const points = cardsToPlay.reduce((sum, c) => sum + c.points, 0);

          this.state.currentTrickPlays.push({
            playerId: player.id,
            playerName: player.name,
            seatIndex: seat,
            isAgent: true,
            cards: cardsToPlay,
            evaluation,
            points,
            playOrder: this.state.currentTrickPlays.length,
          });

          player.hasPlayedCurrentTrick = true;
          this.state.currentTurnSeat = (this.state.currentTurnSeat + 1) % 4;
        }

        const result = resolveTrick(this.state.currentTrick, this.state.currentTrickPlays);
        this.state.tricksHistory.push(result);
        const winner = this.state.players[result.winnerSeatIndex];
        winner.roundScore += result.pointsAwarded;
        this.state.leadSeat = result.winnerSeatIndex;

        if (this.state.currentTrick < 4) {
          this.state.currentTrick += 1;
          this.state.currentTrickPlays = [];
          this.state.players.forEach((p) => {
            p.hasPlayedCurrentTrick = false;
          });
          this.state.currentTurnSeat = this.state.leadSeat;
        } else {
          break; // 4 tricks completed!
        }
      }

      // Finalize this round (appends detailed round record and ML vectors)
      this.finalizeRound();

      if ((this.state.status as string) === 'GAME_OVER') {
        break;
      }

      this.state.currentRound += 1;
    }

    if ((this.state.status as string) !== 'COMPLETED_CLOSED') {
      this.completeGame('system_all_agents');
    }
  }

  public fastForwardAgentGameToCompletion() {
    this.finishGameWithAllAgents();
  }

  public addChatMessage(msg: Omit<TableChatMessage, 'id' | 'timestamp'>): TableChatMessage {
    const chatMsg: TableChatMessage = {
      ...msg,
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
    };
    this.chatMessages.push(chatMsg);
    if (this.chatMessages.length > 80) {
      this.chatMessages = this.chatMessages.slice(-80);
    }
    return chatMsg;
  }

  public getRecentChatMessages(): TableChatMessage[] {
    return this.chatMessages;
  }
}
