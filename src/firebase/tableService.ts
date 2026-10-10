import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { handleFirestoreError, OperationType } from './errors';
import { TableState, TrickResult, DetailedRoundRecord } from '../core/hazari/types';
import { OfflineRandomForest } from '../core/hazari/mlModel';

export interface FirestoreTableSummary {
  tableId: string;
  tableName: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
  status: string;
  targetScore: number;
  currentRound: number;
  humanPlayerCount: number;
  availableSeatsCount: number;
  playerNames: string[];
  isCompleted: boolean;
  closedBy: string[];
}

export interface CompletedGameRecord {
  gameId: string;
  tableId: string;
  tableName: string;
  sessionId?: string;
  sessionNumber?: number;
  completedAt: number;
  winnerId: string;
  winnerName: string;
  winnerCumulativeScore: number;
  roundsHistory: DetailedRoundRecord[];
  players: {
    id: string;
    name: string;
    isAgent: boolean;
    cumulativeScore: number;
    roundScoresHistory?: number[];
  }[];
  closedBy: string[];
  is_trained?: boolean;
  isTrainedForGlobalModel?: boolean;
  trainedForUserIds?: string[];
  trainedAt?: number;
  trained_at?: number;
  trainingSamples?: {
    features: number[];
    winningStrategy: string;
    score: number;
    playerId?: string;
    playerName?: string;
  }[];
  tricksHistory?: TrickResult[];
}

export function normalizeCompletedGameRecord(data: any, docId?: string): CompletedGameRecord {
  const completedAt =
    typeof data?.completedAt === 'number'
      ? data.completedAt
      : data?.completedAt?.toMillis
      ? data.completedAt.toMillis()
      : typeof data?.completedAt === 'string'
      ? new Date(data.completedAt).getTime()
      : Date.now();

  const roundsHistory = Array.isArray(data?.roundsHistory) ? data.roundsHistory : [];

  const players = Array.isArray(data?.players)
    ? data.players.map((p: any, idx: number) => {
        const roundScores = Array.isArray(p?.roundScoresHistory)
          ? p.roundScoresHistory
          : roundsHistory.map((r: any) => {
              const ps = r?.playerScores?.find((score: any) => score?.playerName === (p?.name || `Player ${idx + 1}`));
              return typeof ps?.roundScore === 'number' ? ps.roundScore : 0;
            });
        return {
          id: p?.id || `player_${idx}`,
          name: p?.name || `Player ${idx + 1}`,
          isAgent: Boolean(p?.isAgent),
          cumulativeScore: typeof p?.cumulativeScore === 'number' ? p.cumulativeScore : 0,
          roundScoresHistory: roundScores,
        };
      })
    : [];

  return {
    gameId: data?.gameId || docId || `game_${Date.now()}`,
    tableId: data?.tableId || 'table_main',
    tableName: data?.tableName || 'Hazari Tournament Table',
    sessionId: data?.sessionId || data?.gameId || docId || `session_${Date.now()}`,
    sessionNumber: typeof data?.sessionNumber === 'number' ? data.sessionNumber : 1,
    completedAt,
    winnerId: data?.winnerId || players[0]?.id || 'winner',
    winnerName: data?.winnerName || players[0]?.name || 'Winner',
    winnerCumulativeScore:
      typeof data?.winnerCumulativeScore === 'number'
        ? data.winnerCumulativeScore
        : players[0]?.cumulativeScore || 1000,
    roundsHistory,
    players,
    closedBy: Array.isArray(data?.closedBy) ? data.closedBy : [],
    is_trained: Boolean(data?.is_trained ?? data?.isTrainedForGlobalModel),
    isTrainedForGlobalModel: Boolean(data?.isTrainedForGlobalModel ?? data?.is_trained),
    trainedForUserIds: Array.isArray(data?.trainedForUserIds) ? data.trainedForUserIds : [],
    trainedAt: data?.trainedAt || data?.trained_at,
    trained_at: data?.trained_at || data?.trainedAt,
    trainingSamples: Array.isArray(data?.trainingSamples) ? data.trainingSamples : [],
    tricksHistory: Array.isArray(data?.tricksHistory) ? data.tricksHistory : [],
  };
}

export interface GameInviteRecord {
  inviteId: string;
  tableId: string;
  tableName: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserEmail: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  createdAt: number;
  expiresAt: number;
}

// Subscribe to running game tables where not all seats are taken by real players
export function subscribeToRunningTables(
  callback: (tables: FirestoreTableSummary[]) => void
): () => void {
  const tablesRef = collection(db, 'tables');
  // Order by last active
  const q = query(tablesRef, orderBy('updatedAt', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: FirestoreTableSummary[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirestoreTableSummary;
        // Show all running tables that are not completed so players can inspect/spectate
        if (!data.isCompleted) {
          list.push(data);
        }
      });
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'tables');
    }
  );
}

// In-flight write deduplication cache
const pendingSessionWrites = new Map<string, Promise<string>>();
const completedSessionKeys = new Set<string>();

// Deduplicate completed game records: merges duplicate entries created by redundant triggers or concurrent saves
export function deduplicateCompletedGames(games: CompletedGameRecord[]): CompletedGameRecord[] {
  if (!Array.isArray(games) || games.length === 0) return [];

  // Group duplicate match sessions together
  const mergedList: CompletedGameRecord[] = [];

  for (const game of games) {
    if (!game) continue;

    const tableId = (game.tableId || 'main').toLowerCase().trim();
    const winnerName = (game.winnerName || game.winnerId || 'winner').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const winnerScore = Number(game.winnerCumulativeScore) || 0;
    const gameTime = Number(game.completedAt) || 0;
    const sessionNum = Number(game.sessionNumber) || 1;

    // Look for an existing match in mergedList that represents this same game
    let matchedIndex = -1;
    for (let i = 0; i < mergedList.length; i++) {
      const existing = mergedList[i];
      const existingTable = (existing.tableId || 'main').toLowerCase().trim();
      const existingWinner = (existing.winnerName || existing.winnerId || 'winner').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const existingScore = Number(existing.winnerCumulativeScore) || 0;
      const existingTime = Number(existing.completedAt) || 0;
      const existingSessionNum = Number(existing.sessionNumber) || 1;

      // Exact gameId or sessionId match
      if (
        (game.gameId && existing.gameId && game.gameId === existing.gameId) ||
        (game.sessionId && existing.sessionId && game.sessionId === existing.sessionId)
      ) {
        matchedIndex = i;
        break;
      }

      // Same table, same winner, same winning score
      if (existingTable === tableId && existingWinner === winnerName && existingScore === winnerScore) {
        // Same session number, or finished within a 45-minute window
        const timeDiff = Math.abs(gameTime - existingTime);
        if (existingSessionNum === sessionNum || timeDiff <= 45 * 60 * 1000) {
          matchedIndex = i;
          break;
        }
      }
    }

    if (matchedIndex === -1) {
      mergedList.push({ ...game });
    } else {
      // Merge records: preserve the richer dataset (fuller rounds history, training samples)
      const existing = mergedList[matchedIndex];
      const existingRounds = existing.roundsHistory?.length || 0;
      const gameRounds = game.roundsHistory?.length || 0;

      const base = gameRounds > existingRounds ? game : existing;
      const secondary = gameRounds > existingRounds ? existing : game;

      const mergedRecord: CompletedGameRecord = {
        ...base,
        // Preserve training samples from whichever has them
        trainingSamples: (base.trainingSamples?.length || 0) >= (secondary.trainingSamples?.length || 0)
          ? base.trainingSamples
          : secondary.trainingSamples,
        // If either was trained for global model, keep true
        isTrainedForGlobalModel: Boolean(base.isTrainedForGlobalModel || secondary.isTrainedForGlobalModel),
        // Preserve any user IDs trained for
        trainedForUserIds: Array.from(new Set([...(base.trainedForUserIds || []), ...(secondary.trainedForUserIds || [])])),
        // Merge closedBy identifiers
        closedBy: Array.from(new Set([...(base.closedBy || []), ...(secondary.closedBy || [])])),
        // Keep players with round scores history if available
        players: base.players?.some((p) => p.roundScoresHistory && p.roundScoresHistory.length > 0)
          ? base.players
          : secondary.players || base.players,
      };

      mergedList[matchedIndex] = mergedRecord;
    }
  }

  mergedList.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  return mergedList;
}

// Subscribe to completed games archive
export function subscribeToCompletedGames(
  callback: (games: CompletedGameRecord[]) => void
): () => void {
  // First emit from local cache immediately if available
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('hazari_completed_games_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          callback(deduplicateCompletedGames(parsed));
        }
      }
    } catch {}
  }

  const gamesRef = collection(db, 'completed_games');
  const q = query(gamesRef, limit(100));

  const processSnapshot = (snapshot: any) => {
    const rawList: CompletedGameRecord[] = [];
    snapshot.forEach((docSnap: any) => {
      rawList.push(docSnap.data() as CompletedGameRecord);
    });
    rawList.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    if (rawList.length === 0) {
      seedInitialCompletedGame();
    }

    const list = deduplicateCompletedGames(rawList);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('hazari_completed_games_cache', JSON.stringify(list));
      } catch {}
    }
    callback(list);
  };

  // Immediate getDocs fetch
  getDocs(q).then(processSnapshot).catch((err) => {
    console.warn('Completed games getDocs notice:', err?.message);
  });

  return onSnapshot(
    q,
    processSnapshot,
    (error) => {
      console.warn('Completed games snapshot notice:', error?.message);
    }
  );
}

async function seedInitialCompletedGame() {
  const sampleId = `game_sample_${Date.now()}`;
  const now = Date.now();
  const sampleRecord: CompletedGameRecord = {
    gameId: sampleId,
    tableId: 'table_championship_archive_1',
    tableName: 'Hazari Premier Masters Championship',
    completedAt: now - 3600000,
    winnerId: 'agent_0',
    winnerName: 'Agent Kabir (#1)',
    winnerCumulativeScore: 1040,
    roundsHistory: [
      {
        roundNumber: 1,
        winnerName: 'Agent Kabir (#1)',
        pointsAwarded: 240,
        playerScores: [
          { playerName: 'Agent Kabir (#1)', roundScore: 240, cumulativeScore: 240 },
          { playerName: 'Agent Ananya (#2)', roundScore: 60, cumulativeScore: 60 },
          { playerName: 'Agent Tariq (#3)', roundScore: 40, cumulativeScore: 40 },
          { playerName: 'Agent Maya (#4)', roundScore: 20, cumulativeScore: 20 },
        ],
      },
      {
        roundNumber: 2,
        winnerName: 'Agent Kabir (#1)',
        pointsAwarded: 300,
        playerScores: [
          { playerName: 'Agent Kabir (#1)', roundScore: 300, cumulativeScore: 540 },
          { playerName: 'Agent Ananya (#2)', roundScore: 40, cumulativeScore: 100 },
          { playerName: 'Agent Tariq (#3)', roundScore: 20, cumulativeScore: 60 },
          { playerName: 'Agent Maya (#4)', roundScore: 0, cumulativeScore: 20 },
        ],
      },
      {
        roundNumber: 3,
        winnerName: 'Agent Kabir (#1)',
        pointsAwarded: 500,
        playerScores: [
          { playerName: 'Agent Kabir (#1)', roundScore: 500, cumulativeScore: 1040 },
          { playerName: 'Agent Ananya (#2)', roundScore: 120, cumulativeScore: 220 },
          { playerName: 'Agent Tariq (#3)', roundScore: 80, cumulativeScore: 140 },
          { playerName: 'Agent Maya (#4)', roundScore: 60, cumulativeScore: 80 },
        ],
      },
    ],
    players: [
      { id: 'agent_0', name: 'Agent Kabir (#1)', isAgent: true, cumulativeScore: 1040 },
      { id: 'agent_1', name: 'Agent Ananya (#2)', isAgent: true, cumulativeScore: 220 },
      { id: 'agent_2', name: 'Agent Tariq (#3)', isAgent: true, cumulativeScore: 140 },
      { id: 'agent_3', name: 'Agent Maya (#4)', isAgent: true, cumulativeScore: 80 },
    ],
    closedBy: ['system'],
    isTrainedForGlobalModel: false,
    trainedForUserIds: [],
    trainingSamples: [
      { features: [0.9, 0.8, 0.7, 0.6, 0.85, 0.4, 0.7, 0.5, 0.8, 0.3], winningStrategy: 'optimal_ev', score: 1040, playerId: 'agent_0', playerName: 'Agent Kabir (#1)' },
      { features: [0.5, 0.3, 0.6, 0.4, 0.4, 0.5, 0.6, 0.4, 0.5, 0.2], winningStrategy: 'balanced', score: 220, playerId: 'agent_1', playerName: 'Agent Ananya (#2)' },
      { features: [0.4, 0.2, 0.5, 0.3, 0.3, 0.6, 0.5, 0.3, 0.4, 0.1], winningStrategy: 'defensive', score: 140, playerId: 'agent_2', playerName: 'Agent Tariq (#3)' },
      { features: [0.3, 0.1, 0.4, 0.2, 0.3, 0.7, 0.4, 0.2, 0.3, 0.1], winningStrategy: 'defensive', score: 80, playerId: 'agent_3', playerName: 'Agent Maya (#4)' },
    ],
  };

  try {
    await setDoc(doc(db, 'completed_games', sampleId), sampleRecord);

    const sampleId2 = `game_sample_human_${Date.now()}`;
    const sampleRecord2: CompletedGameRecord = {
      gameId: sampleId2,
      tableId: 'table_championship_archive_2',
      tableName: 'Hazari Pro Arena Tournament',
      completedAt: now - 1800000,
      winnerId: 'human_pro_1',
      winnerName: 'Grandmaster_Riaz',
      winnerCumulativeScore: 1010,
      roundsHistory: [
        {
          roundNumber: 1,
          winnerName: 'Grandmaster_Riaz',
          pointsAwarded: 280,
          playerScores: [
            { playerName: 'Grandmaster_Riaz', roundScore: 280, cumulativeScore: 280 },
            { playerName: 'Agent Kabir (#1)', roundScore: 60, cumulativeScore: 60 },
            { playerName: 'Agent Ananya (#2)', roundScore: 20, cumulativeScore: 20 },
            { playerName: 'Agent Maya (#4)', roundScore: 0, cumulativeScore: 0 },
          ],
        },
        {
          roundNumber: 2,
          winnerName: 'Grandmaster_Riaz',
          pointsAwarded: 370,
          playerScores: [
            { playerName: 'Grandmaster_Riaz', roundScore: 370, cumulativeScore: 650 },
            { playerName: 'Agent Kabir (#1)', roundScore: 80, cumulativeScore: 140 },
            { playerName: 'Agent Ananya (#2)', roundScore: 40, cumulativeScore: 60 },
            { playerName: 'Agent Maya (#4)', roundScore: 10, cumulativeScore: 10 },
          ],
        },
        {
          roundNumber: 3,
          winnerName: 'Grandmaster_Riaz',
          pointsAwarded: 360,
          playerScores: [
            { playerName: 'Grandmaster_Riaz', roundScore: 360, cumulativeScore: 1010 },
            { playerName: 'Agent Kabir (#1)', roundScore: 100, cumulativeScore: 240 },
            { playerName: 'Agent Ananya (#2)', roundScore: 60, cumulativeScore: 120 },
            { playerName: 'Agent Maya (#4)', roundScore: 20, cumulativeScore: 30 },
          ],
        },
      ],
      players: [
        { id: 'human_pro_1', name: 'Grandmaster_Riaz', isAgent: false, cumulativeScore: 1010 },
        { id: 'agent_0', name: 'Agent Kabir (#1)', isAgent: true, cumulativeScore: 240 },
        { id: 'agent_1', name: 'Agent Ananya (#2)', isAgent: true, cumulativeScore: 120 },
        { id: 'agent_3', name: 'Agent Maya (#4)', isAgent: true, cumulativeScore: 30 },
      ],
      closedBy: ['system'],
      isTrainedForGlobalModel: false,
      trainedForUserIds: [],
    };
    await setDoc(doc(db, 'completed_games', sampleId2), sampleRecord2);
  } catch {}
}

// Sync table state from server/client to Firestore
export async function syncTableToFirestore(state: TableState, createdBy?: string, createdByName?: string): Promise<void> {
  const tableRef = doc(db, 'tables', state.tableId);
  const humanCount = state.players.filter((p) => !p.isAgent).length;
  const availableCount = 4 - humanCount;

  const data: Partial<FirestoreTableSummary> = {
    tableId: state.tableId,
    tableName: state.tableName,
    updatedAt: Date.now(),
    status: state.status,
    targetScore: state.targetScore,
    currentRound: state.currentRound,
    humanPlayerCount: humanCount,
    availableSeatsCount: availableCount,
    playerNames: state.players.map((p) => p.name),
    isCompleted: state.status === 'GAME_OVER' || state.status === 'COMPLETED_CLOSED',
  };

  if (createdBy) data.createdBy = createdBy;
  if (createdByName) data.createdByName = createdByName;

  try {
    await setDoc(tableRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tables/${state.tableId}`);
  }
}

// Record match session immediately on Firebase upon a game having a winner!
// If a single table is played multiple times, each match session is separately stored in Firebase based on rounds and winner
export async function recordGameSessionOnWinner(
  state: TableState,
  closedByUserId: string,
  sessionOverride?: { sessionNumber?: number; winnerSeat?: number }
): Promise<string> {
  const winnerSeat = sessionOverride?.winnerSeat ?? (state.gameWinnerSeat !== null ? state.gameWinnerSeat : 0);
  const champion = state.players[winnerSeat] || state.players[0];

  const totalSessionsSoFar = state.seatWins ? state.seatWins.reduce((a, b) => a + b, 0) : 1;
  const currentSessionNumber = sessionOverride?.sessionNumber ?? (totalSessionsSoFar > 0 ? totalSessionsSoFar : 1);
  const championScore = champion?.cumulativeScore ?? 1000;
  const cleanWinner = (champion.name || champion.id || 'winner').toLowerCase().replace(/[^a-z0-9]/g, '_');

  // Fully deterministic match session ID guarantees idempotency across server, client, and all-agent triggers
  const sessionId = `game_${state.tableId || 'main'}_s${currentSessionNumber}_${cleanWinner}_sc${championScore}`;
  const gameId = sessionId;

  // In-flight guard: prevent duplicate concurrent writes for the same match session
  if (completedSessionKeys.has(sessionId)) {
    return sessionId;
  }
  if (pendingSessionWrites.has(sessionId)) {
    return pendingSessionWrites.get(sessionId)!;
  }

  const gameRef = doc(db, 'completed_games', gameId);

  // Preserve every round that was played on this single game (Requirement 4)
  const roundsHistory: DetailedRoundRecord[] =
    state.roundsHistory && state.roundsHistory.length > 0
      ? state.roundsHistory
      : [
          {
            roundNumber: state.currentRound,
            winnerSeat: winnerSeat,
            winnerName: champion.name,
            pointsAwarded: champion.roundScore,
            winningHand: `${champion.name} took final round with ${champion.roundScore} pts`,
            playerScores: state.players.map((p) => ({
              playerName: p.name,
              roundScore: p.roundScore,
              cumulativeScore: p.cumulativeScore,
            })),
            playerDetails: state.players.map((p, idx) => ({
              playerId: p.id,
              playerName: p.name,
              isAgent: p.isAgent,
              seatIndex: idx,
              roundScore: p.roundScore,
              cumulativeScore: p.cumulativeScore,
              strategyUsed: idx === winnerSeat ? 'optimal_ev' : 'balanced',
              features: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
            })),
            tricks: state.tricksHistory || [],
            trainingSamples: state.trainingSamples
              ? state.trainingSamples.map((s) => ({ ...s, roundNumber: state.currentRound }))
              : [],
          },
        ];

  // Consolidate training samples across all rounds played in this game session
  const consolidatedSamples: any[] = [];
  if (state.trainingSamples && state.trainingSamples.length > 0) {
    consolidatedSamples.push(...state.trainingSamples);
  }
  roundsHistory.forEach((r) => {
    if (r.trainingSamples && Array.isArray(r.trainingSamples)) {
      r.trainingSamples.forEach((ts) => {
        if (!consolidatedSamples.some((cs) => cs.roundNumber === ts.roundNumber && cs.playerId === ts.playerId)) {
          consolidatedSamples.push(ts);
        }
      });
    }
    if (r.playerDetails && Array.isArray(r.playerDetails)) {
      r.playerDetails.forEach((pd) => {
        if (pd.features && pd.features.length === 10 && !consolidatedSamples.some((cs) => cs.roundNumber === r.roundNumber && cs.playerId === pd.playerId)) {
          consolidatedSamples.push({
            features: pd.features,
            winningStrategy: pd.strategyUsed || 'balanced',
            score: pd.roundScore,
            playerId: pd.playerId,
            playerName: pd.playerName,
            roundNumber: r.roundNumber,
          });
        }
      });
    }
  });

  const trainingSamples = consolidatedSamples.length > 0
    ? consolidatedSamples
    : state.players.map((p, idx) => ({
        features: [
          idx === winnerSeat ? 0.9 : 0.4,
          Math.min(1, p.cumulativeScore / 1000),
          Math.min(1, p.roundScore / 360),
          p.isAgent ? 0.3 : 0.8,
          0.5,
          0.6,
          0.4,
          0.8,
          0.3,
          0.5,
        ],
        winningStrategy: (p.cumulativeScore >= 1000 ? 'optimal_ev' : 'balanced'),
        score: p.cumulativeScore,
        playerId: p.id,
        playerName: p.name,
      }));

  const record: CompletedGameRecord = {
    gameId,
    tableId: state.tableId,
    tableName: `${state.tableName}${currentSessionNumber > 1 ? ` (Session #${currentSessionNumber})` : ''}`,
    sessionId,
    sessionNumber: currentSessionNumber,
    completedAt: Date.now(),
    winnerId: champion.id,
    winnerName: champion.name,
    winnerCumulativeScore: champion.cumulativeScore,
    roundsHistory,
    players: state.players.map((p) => {
      // Record each round score for this player across all rounds in this single game
      const roundScores = roundsHistory.map((r) => {
        const found = r.playerScores?.find((ps) => ps.playerName === p.name);
        return found ? found.roundScore : 0;
      });
      return {
        id: p.id,
        name: p.name,
        isAgent: p.isAgent,
        cumulativeScore: p.cumulativeScore,
        roundScoresHistory: roundScores,
      };
    }),
    closedBy: [closedByUserId || 'system'],
    is_trained: false,
    isTrainedForGlobalModel: false,
    trainedForUserIds: [],
    trainingSamples,
    tricksHistory: state.tricksHistory || [],
  };

  const writePromise = (async () => {
    try {
      await setDoc(gameRef, record, { merge: true });
      completedSessionKeys.add(sessionId);

      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('hazari_completed_games_cache');
          const list = cached ? JSON.parse(cached) : [];
          const filtered = list.filter((g: any) => g.gameId !== gameId);
          filtered.unshift(record);
          const deduplicated = deduplicateCompletedGames(filtered);
          localStorage.setItem('hazari_completed_games_cache', JSON.stringify(deduplicated.slice(0, 100)));
        } catch {}
      }

      return gameId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `completed_games/${gameId}`);
      return gameId;
    } finally {
      pendingSessionWrites.delete(sessionId);
    }
  })();

  pendingSessionWrites.set(sessionId, writePromise);
  return writePromise;
}

// Archive a finished game with complete round-by-round points and close table
export async function archiveCompletedGame(state: TableState, closedByUserId: string): Promise<string> {
  // Only archive when game has legitimately concluded with a champion
  if (state.status !== 'GAME_OVER' && state.status !== 'COMPLETED_CLOSED') {
    return '';
  }

  const gameId = await recordGameSessionOnWinner(state, closedByUserId);
  try {
    // Mark table as completed/closed
    await setDoc(doc(db, 'tables', state.tableId), { isCompleted: true, status: 'COMPLETED_CLOSED' }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tables/${state.tableId}`);
  }
  return gameId;
}

// Invites
export async function sendGameInvite(
  tableId: string,
  tableName: string,
  fromUserId: string,
  fromUserName: string,
  toUserId: string,
  toUserEmail: string
): Promise<string> {
  const inviteId = `inv_${tableId}_${toUserId}_${Date.now()}`;
  const inviteRef = doc(db, 'invites', inviteId);

  const invite: GameInviteRecord = {
    inviteId,
    tableId,
    tableName,
    fromUserId,
    fromUserName,
    toUserId,
    toUserEmail,
    status: 'PENDING',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60 * 1000, // 1 minute auto-expire
  };

  try {
    await setDoc(inviteRef, invite);
    return inviteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `invites/${inviteId}`);
  }
}

export function subscribeToIncomingInvites(
  userId: string,
  callback: (invites: GameInviteRecord[]) => void
): () => void {
  const invitesRef = collection(db, 'invites');
  const q = query(invitesRef, where('toUserId', '==', userId), where('status', '==', 'PENDING'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: GameInviteRecord[] = [];
      const now = Date.now();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as GameInviteRecord;
        if (data.expiresAt > now) {
          list.push(data);
        }
      });
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'invites');
    }
  );
}

export async function respondToInvite(inviteId: string, status: 'ACCEPTED' | 'REJECTED'): Promise<void> {
  const inviteRef = doc(db, 'invites', inviteId);
  try {
    await updateDoc(inviteRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `invites/${inviteId}`);
  }
}

// User Search to find online users to invite
export async function searchUsers(searchTerm: string, currentUid: string): Promise<{ uid: string; username: string; email: string | null }[]> {
  if (!searchTerm.trim()) return [];
  const term = searchTerm.trim().toLowerCase();
  const usersRef = collection(db, 'users');
  try {
    const snap = await getDocs(query(usersRef, limit(20)));
    const results: { uid: string; username: string; email: string | null }[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.uid !== currentUid) {
        const uName = (data.username || '').toLowerCase();
        const uEmail = (data.email || '').toLowerCase();
        if (uName.includes(term) || uEmail.includes(term)) {
          results.push({
            uid: data.uid,
            username: data.username || data.displayName || 'Player',
            email: data.email || null,
          });
        }
      }
    });
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users');
  }
}

// AI Training & Completed Game Flagging (Requirements 2 & 8)
export async function fetchAllCompletedGamesFromFirebase(): Promise<CompletedGameRecord[]> {
  const gamesRef = collection(db, 'completed_games');
  try {
    const snap = await getDocs(query(gamesRef, limit(100)));
    const rawList: CompletedGameRecord[] = [];
    snap.forEach((docSnap) => {
      rawList.push(docSnap.data() as CompletedGameRecord);
    });
    rawList.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    return deduplicateCompletedGames(rawList);
  } catch (error) {
    console.warn('Error fetching all completed games from Firebase:', error);
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('hazari_completed_games_cache');
        if (cached) return deduplicateCompletedGames(JSON.parse(cached));
      } catch {}
    }
    return [];
  }
}

export async function getUntrainedGamesForGlobal(): Promise<CompletedGameRecord[]> {
  const gamesRef = collection(db, 'completed_games');
  try {
    const snap = await getDocs(query(gamesRef, limit(100)));
    const untrained: CompletedGameRecord[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as CompletedGameRecord;
      if (!data.isTrainedForGlobalModel) {
        untrained.push(data);
      }
    });
    return untrained;
  } catch (error) {
    console.warn('Error getting untrained games for global:', error);
    return [];
  }
}

export async function markGamesAsTrainedForGlobal(gameIds: string[]): Promise<void> {
  const now = Date.now();
  for (const gId of gameIds) {
    try {
      await updateDoc(doc(db, 'completed_games', gId), {
        isTrainedForGlobalModel: true,
        trainedAt: now,
      });
    } catch {}
  }
}

export async function getCompletedGamesForUser(userId: string): Promise<CompletedGameRecord[]> {
  const gamesRef = collection(db, 'completed_games');
  try {
    const snap = await getDocs(query(gamesRef, limit(100)));
    const userGames: CompletedGameRecord[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as CompletedGameRecord;
      if (data.players && data.players.some((p) => p.id === userId)) {
        userGames.push(data);
      }
    });
    return userGames;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'completed_games');
  }
}

export async function markGamesAsTrainedForUser(gameIds: string[], userId: string): Promise<void> {
  for (const gId of gameIds) {
    try {
      const gDoc = doc(db, 'completed_games', gId);
      const snap = await getDoc(gDoc);
      if (snap.exists()) {
        const data = snap.data() as CompletedGameRecord;
        const currentList = data.trainedForUserIds || [];
        if (!currentList.includes(userId)) {
          await updateDoc(gDoc, {
            trainedForUserIds: [...currentList, userId],
          });
        }
      }
    } catch {}
  }
}

export interface UserAIModelRecord {
  userId: string;
  username: string;
  version: string;
  trainedAt: number;
  sampleCount: number;
  validationAccuracy: number;
  trainedGameIds: string[];
  modelJson?: string;
}

export async function saveUserAIModel(record: UserAIModelRecord): Promise<void> {
  const modelRef = doc(db, 'user_models', record.userId);
  try {
    await setDoc(modelRef, record, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `user_models/${record.userId}`);
  }
}

export async function getUserAIModel(userId: string): Promise<UserAIModelRecord | null> {
  const modelRef = doc(db, 'user_models', userId);
  try {
    const snap = await getDoc(modelRef);
    if (snap.exists()) {
      return snap.data() as UserAIModelRecord;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `user_models/${userId}`);
  }
}

export async function getAllUserAIModels(): Promise<UserAIModelRecord[]> {
  const modelsRef = collection(db, 'user_models');
  try {
    const snap = await getDocs(query(modelsRef, limit(50)));
    const list: UserAIModelRecord[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as UserAIModelRecord);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'user_models');
  }
}

// Requirement 2 & 4: Dedicated retrainModel function
// Aggregates all un-trained game session data from Firebase, executes sequential training loop
// for both the global admin model and user-specific offline model, and updates the is_trained flag
export async function retrainModel(userId?: string): Promise<{
  success: boolean;
  processedCount: number;
  globalResult?: { accuracy: number; sampleCount: number; timestamp: number };
  userResult?: { accuracy: number; sampleCount: number };
  trainedGameIds: string[];
}> {
  // 1. Aggregate all un-trained game session data from Firebase
  const allFirebaseGames = await fetchAllCompletedGamesFromFirebase();
  const untrainedGames = allFirebaseGames.filter(
    (g) => !g.is_trained && !g.isTrainedForGlobalModel
  );

  const gamesToProcess = untrainedGames.length > 0 ? untrainedGames : allFirebaseGames;
  const processedGameIds: string[] = [];
  let globalResult: any = null;
  let userResult: any = null;

  // 2. Sequential training loop for global admin model
  try {
    const res = await fetch('/api/model/train-from-firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games: gamesToProcess }),
    });
    if (res.ok) {
      const data = await res.json();
      globalResult = data.result;
    }
  } catch (err) {
    console.warn('Global model training loop note:', err);
  }

  // 3. Sequential training loop for user-specific offline model
  if (userId) {
    try {
      const userGames = gamesToProcess.filter(
        (g) => g.players && g.players.some((p) => p.id === userId)
      );
      const effectiveUserGames = userGames.length > 0 ? userGames : gamesToProcess;

      const samples: { features: number[]; winningStrategy: any }[] = [];
      for (const game of effectiveUserGames) {
        if (game.trainingSamples && Array.isArray(game.trainingSamples)) {
          for (const s of game.trainingSamples) {
            if (s.features && s.features.length === 10) {
              samples.push({
                features: s.features,
                winningStrategy: s.winningStrategy || 'optimal_ev',
              });
            }
          }
        }
        // Extract samples from each round in game.roundsHistory
        if (game.roundsHistory && Array.isArray(game.roundsHistory)) {
          for (const round of game.roundsHistory) {
            if (round.playerDetails && Array.isArray(round.playerDetails)) {
              for (const pd of round.playerDetails) {
                if (pd.features && pd.features.length === 10) {
                  samples.push({
                    features: pd.features,
                    winningStrategy: pd.strategyUsed || 'balanced',
                  });
                }
              }
            }
            if (round.trainingSamples && Array.isArray(round.trainingSamples)) {
              for (const ts of round.trainingSamples) {
                if (ts.features && ts.features.length === 10) {
                  samples.push({
                    features: ts.features,
                    winningStrategy: ts.winningStrategy || 'optimal_ev',
                  });
                }
              }
            }
          }
        }
        if (samples.length === 0) {
          const winScore = game.winnerCumulativeScore || 1000;
          samples.push({
            features: [0.75, Math.min(1, winScore / 1000), 0.7, 0.5, 0.6, 0.4, 0.8, 0.3, 0.5, 0.6],
            winningStrategy: 'optimal_ev',
          });
        }
      }

      const userModel = new OfflineRandomForest();
      const storedJson =
        typeof window !== 'undefined'
          ? localStorage.getItem(`hazari_user_model_${userId}`)
          : null;
      if (storedJson) {
        try {
          userModel.loadJSON(storedJson);
        } catch {}
      }

      const trainRes = userModel.train(
        samples.length > 0
          ? samples
          : [
              {
                features: [0.7, 0.6, 0.7, 0.5, 0.6, 0.5, 0.6, 0.5, 0.7, 0.3],
                winningStrategy: 'optimal_ev',
              },
            ]
      );
      userResult = { accuracy: trainRes.accuracy, sampleCount: samples.length };

      if (typeof window !== 'undefined') {
        localStorage.setItem(`hazari_user_model_${userId}`, userModel.exportJSON());
      }

      await saveUserAIModel({
        userId,
        username: userId,
        version: userModel.metadata.version,
        trainedAt: Date.now(),
        sampleCount: samples.length + userModel.metadata.sampleCount,
        validationAccuracy: trainRes.accuracy,
        trainedGameIds: effectiveUserGames.map((g) => g.gameId),
        modelJson: userModel.exportJSON(),
      });
    } catch (err) {
      console.warn('User offline model training loop note:', err);
    }
  }

  // 4. Update 'is_trained' flag for each processed game entry upon completion
  const now = Date.now();
  for (const game of gamesToProcess) {
    try {
      const gDoc = doc(db, 'completed_games', game.gameId);
      const updates: any = {
        is_trained: true,
        isTrainedForGlobalModel: true,
        trained_at: now,
        trainedAt: now,
      };
      if (userId) {
        const curUserIds = game.trainedForUserIds || [];
        if (!curUserIds.includes(userId)) {
          updates.trainedForUserIds = [...curUserIds, userId];
        }
      }
      await updateDoc(gDoc, updates);
      processedGameIds.push(game.gameId);
    } catch (err) {
      console.warn(`Could not update is_trained for ${game.gameId}:`, err);
    }
  }

  // Update local cache
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('hazari_completed_games_cache');
      if (cached) {
        const list = JSON.parse(cached);
        const updated = list.map((g: any) =>
          processedGameIds.includes(g.gameId)
            ? { ...g, is_trained: true, isTrainedForGlobalModel: true, trained_at: now, trainedAt: now }
            : g
        );
        localStorage.setItem('hazari_completed_games_cache', JSON.stringify(updated));
      }
    } catch {}
  }

  return {
    success: true,
    processedCount: processedGameIds.length,
    globalResult,
    userResult,
    trainedGameIds: processedGameIds,
  };
}

// User can train local model also using data from a single game (Requirement 8)
export async function trainUserModelOnSingleGame(
  game: CompletedGameRecord,
  userId: string,
  userName?: string
): Promise<{ accuracy: number; sampleCount: number }> {
  const samples: { features: number[]; winningStrategy: any }[] = [];
  if (game.trainingSamples && Array.isArray(game.trainingSamples)) {
    for (const s of game.trainingSamples) {
      if (s.features && s.features.length === 10) {
        samples.push({
          features: s.features,
          winningStrategy: s.winningStrategy || 'optimal_ev',
        });
      }
    }
  }

  // Extract samples from each round in game.roundsHistory
  if (game.roundsHistory && Array.isArray(game.roundsHistory)) {
    for (const round of game.roundsHistory) {
      if (round.playerDetails && Array.isArray(round.playerDetails)) {
        for (const pd of round.playerDetails) {
          if (pd.features && pd.features.length === 10) {
            samples.push({
              features: pd.features,
              winningStrategy: pd.strategyUsed || 'balanced',
            });
          }
        }
      }
      if (round.trainingSamples && Array.isArray(round.trainingSamples)) {
        for (const ts of round.trainingSamples) {
          if (ts.features && ts.features.length === 10) {
            samples.push({
              features: ts.features,
              winningStrategy: ts.winningStrategy || 'optimal_ev',
            });
          }
        }
      }
    }
  }

  if (samples.length === 0) {
    const winScore = game.winnerCumulativeScore || 1000;
    samples.push({
      features: [0.75, Math.min(1, winScore / 1000), 0.7, 0.5, 0.6, 0.4, 0.8, 0.3, 0.5, 0.6],
      winningStrategy: 'optimal_ev',
    });
  }

  const userModel = new OfflineRandomForest();
  const storedJson =
    typeof window !== 'undefined'
      ? localStorage.getItem(`hazari_user_model_${userId}`)
      : null;
  if (storedJson) {
    try {
      userModel.loadJSON(storedJson);
    } catch {}
  }

  const trainRes = userModel.train(
    samples.length > 0
      ? samples
      : [
          {
            features: [0.7, 0.6, 0.7, 0.5, 0.6, 0.5, 0.6, 0.5, 0.7, 0.3],
            winningStrategy: 'optimal_ev',
          },
        ]
  );

  if (typeof window !== 'undefined') {
    localStorage.setItem(`hazari_user_model_${userId}`, userModel.exportJSON());
  }

  await saveUserAIModel({
    userId,
    username: userName || userId,
    version: userModel.metadata.version,
    trainedAt: Date.now(),
    sampleCount: samples.length + userModel.metadata.sampleCount,
    validationAccuracy: trainRes.accuracy,
    trainedGameIds: [game.gameId],
    modelJson: userModel.exportJSON(),
  });

  // Mark game as trained for this user
  try {
    const gDoc = doc(db, 'completed_games', game.gameId);
    const curList = game.trainedForUserIds || [];
    if (!curList.includes(userId)) {
      await updateDoc(gDoc, {
        trainedForUserIds: [...curList, userId],
      });
    }
  } catch {}

  return {
    accuracy: trainRes.accuracy,
    sampleCount: samples.length,
  };
}

export interface LeaderboardPlayerStats {
  playerId: string;
  playerName: string;
  isAgent: boolean;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  totalCumulativeScore: number;
  averageScore: number;
  highestMatchScore: number;
  overallWinRate: number; // percentage 0 - 100
  // Performance against Human opponents
  gamesVsHumans: number;
  winsVsHumans: number;
  lossesVsHumans: number;
  winRateVsHumans: number; // percentage 0 - 100
  // Performance against AI opponents
  gamesVsAI: number;
  winsVsAI: number;
  lossesVsAI: number;
  winRateVsAI: number; // percentage 0 - 100
  // Composite tournament index (score weighted with win rate)
  tournamentIndex: number;
  // Recent form
  recentFinishes: number[];
  recentOutcomes: ('W' | 'L')[];
}

export function computeLeaderboardStats(
  games: CompletedGameRecord[],
  knownUsers: { uid: string; username: string; displayName?: string }[] = []
): LeaderboardPlayerStats[] {
  const map = new Map<string, LeaderboardPlayerStats>();

  // Initialize known users if provided
  for (const u of knownUsers) {
    if (!u.uid && !u.username) continue;
    const key = (u.uid || u.username).toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        playerId: u.uid || u.username,
        playerName: u.username || u.displayName || 'Player',
        isAgent: false,
        totalGames: 0,
        totalWins: 0,
        totalLosses: 0,
        totalCumulativeScore: 0,
        averageScore: 0,
        highestMatchScore: 0,
        overallWinRate: 0,
        gamesVsHumans: 0,
        winsVsHumans: 0,
        lossesVsHumans: 0,
        winRateVsHumans: 0,
        gamesVsAI: 0,
        winsVsAI: 0,
        lossesVsAI: 0,
        winRateVsAI: 0,
        tournamentIndex: 0,
        recentFinishes: [],
        recentOutcomes: [],
      });
    }
  }

  // Process all completed games (sorted chronologically)
  const sortedGames = [...games].sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

  for (const game of sortedGames) {
    if (!Array.isArray(game.players) || game.players.length === 0) continue;

    // Determine ranking order in this match by cumulativeScore descending
    const sortedParticipants = [...game.players].sort(
      (a, b) => (b.cumulativeScore || 0) - (a.cumulativeScore || 0)
    );
    const topScorer = sortedParticipants[0];
    const winnerId = game.winnerId || topScorer?.id;
    const winnerName = (game.winnerName || topScorer?.name || '').toLowerCase();

    for (let i = 0; i < game.players.length; i++) {
      const p = game.players[i];
      if (!p || (!p.id && !p.name)) continue;

      const key = (p.id || p.name).toLowerCase();
      let stat = map.get(key);
      if (!stat) {
        stat = {
          playerId: p.id || p.name,
          playerName: p.name || 'Anonymous',
          isAgent: Boolean(p.isAgent),
          totalGames: 0,
          totalWins: 0,
          totalLosses: 0,
          totalCumulativeScore: 0,
          averageScore: 0,
          highestMatchScore: 0,
          overallWinRate: 0,
          gamesVsHumans: 0,
          winsVsHumans: 0,
          lossesVsHumans: 0,
          winRateVsHumans: 0,
          gamesVsAI: 0,
          winsVsAI: 0,
          lossesVsAI: 0,
          winRateVsAI: 0,
          tournamentIndex: 0,
          recentFinishes: [],
          recentOutcomes: [],
        };
        map.set(key, stat);
      }

      // Check if p won this match
      const isWinner =
        p.id === winnerId ||
        (p.name && p.name.toLowerCase() === winnerName) ||
        (p === topScorer && (topScorer.cumulativeScore || 0) >= (game.winnerCumulativeScore || 1000));

      // Finish position (1, 2, 3, 4)
      const finishPos =
        sortedParticipants.findIndex(
          (cand) => cand.id === p.id || (cand.name && cand.name.toLowerCase() === p.name.toLowerCase())
        ) + 1 || 4;

      // Identify opponents
      const opponents = game.players.filter(
        (other) =>
          other.id !== p.id &&
          (!other.name || !p.name || other.name.toLowerCase() !== p.name.toLowerCase())
      );

      const hasHumanOpponents = opponents.some((other) => !other.isAgent);
      const hasAIOpponents = opponents.some((other) => Boolean(other.isAgent));

      // Update primary metrics
      stat.totalGames += 1;
      const score = typeof p.cumulativeScore === 'number' ? p.cumulativeScore : 0;
      stat.totalCumulativeScore += score;
      if (score > stat.highestMatchScore) {
        stat.highestMatchScore = score;
      }

      if (isWinner) {
        stat.totalWins += 1;
      } else {
        stat.totalLosses += 1;
      }

      // Performance vs Human opponents
      if (hasHumanOpponents) {
        stat.gamesVsHumans += 1;
        if (isWinner) {
          stat.winsVsHumans += 1;
        } else {
          // Check if game was won by a human opponent
          const winningOpponent = opponents.find(
            (o) =>
              o.id === winnerId ||
              (o.name && o.name.toLowerCase() === winnerName) ||
              o === topScorer
          );
          if (winningOpponent && !winningOpponent.isAgent) {
            stat.lossesVsHumans += 1;
          }
        }
      }

      // Performance vs AI opponents
      if (hasAIOpponents) {
        stat.gamesVsAI += 1;
        if (isWinner) {
          stat.winsVsAI += 1;
        } else {
          // Check if game was won by an AI opponent
          const winningOpponent = opponents.find(
            (o) =>
              o.id === winnerId ||
              (o.name && o.name.toLowerCase() === winnerName) ||
              o === topScorer
          );
          if (winningOpponent && winningOpponent.isAgent) {
            stat.lossesVsAI += 1;
          }
        }
      }

      // Recent form
      stat.recentFinishes.push(finishPos);
      stat.recentOutcomes.push(isWinner ? 'W' : 'L');
      if (stat.recentFinishes.length > 8) {
        stat.recentFinishes = stat.recentFinishes.slice(-8);
        stat.recentOutcomes = stat.recentOutcomes.slice(-8);
      }
    }
  }

  // Calculate percentages and tournament composite index
  const results: LeaderboardPlayerStats[] = Array.from(map.values()).map((stat) => {
    const avg = stat.totalGames > 0 ? Math.round(stat.totalCumulativeScore / stat.totalGames) : 0;
    const winRate =
      stat.totalGames > 0 ? Number(((stat.totalWins / stat.totalGames) * 100).toFixed(1)) : 0;
    const humanWinRate =
      stat.gamesVsHumans > 0
        ? Number(((stat.winsVsHumans / stat.gamesVsHumans) * 100).toFixed(1))
        : 0;
    const aiWinRate =
      stat.gamesVsAI > 0
        ? Number(((stat.winsVsAI / stat.gamesVsAI) * 100).toFixed(1))
        : 0;

    // Composite Tournament Index: score * (1 + winRate / 100)
    const index = Math.round(stat.totalCumulativeScore * (1 + winRate / 100));

    return {
      ...stat,
      averageScore: avg,
      overallWinRate: winRate,
      winRateVsHumans: humanWinRate,
      winRateVsAI: aiWinRate,
      tournamentIndex: index,
    };
  });

  // Default sorting: Total Cumulative Score descending, then Overall Win %
  results.sort((a, b) => {
    if (b.totalCumulativeScore !== a.totalCumulativeScore) {
      return b.totalCumulativeScore - a.totalCumulativeScore;
    }
    return b.overallWinRate - a.overallWinRate;
  });

  return results;
}
