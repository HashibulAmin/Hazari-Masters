import fs from 'fs';
import path from 'path';
import { TableState, Player, Card } from '../src/core/hazari/types';
import { extractFeatures } from '../src/core/hazari/features';
import { offlineModel } from '../src/core/hazari/mlModel';
import { ArrangementStrategy } from '../src/core/hazari/arranger';

export interface GamePipelineRecord {
  gameId: string;
  tableId: string;
  tableName: string;
  timestamp: number;
  roundNumber: number;
  winnerSeatIndex: number;
  winnerName: string;
  winnerStrategy: ArrangementStrategy;
  winningHandPoints: number;
  winningHandFeatures: number[];
  playerRecords: {
    seatIndex: number;
    playerId: string;
    playerName: string;
    isAgent: boolean;
    roundScore: number;
    cumulativeScore: number;
    strategyUsed: ArrangementStrategy;
    features: number[];
  }[];
  totalRoundPoints: number;
}

export class GameDataPipeline {
  private pipelineFilePath: string;
  private modelFilePath: string;
  private records: GamePipelineRecord[] = [];
  private lastDailyTrainTime: number = Date.now();
  private timer: NodeJS.Timeout | null = null;
  private onModelUpdate?: (meta: any) => void;

  constructor(onModelUpdateCallback?: (meta: any) => void) {
    this.pipelineFilePath = path.join(process.cwd(), 'data', 'hazari_game_pipeline.json');
    this.modelFilePath = path.join(process.cwd(), 'data', 'hazari_offline_model.json');
    this.onModelUpdate = onModelUpdateCallback;
    this.loadRecords();
    this.loadModel();
    this.initDailyTrainingScheduler();
  }

  private loadModel() {
    try {
      if (fs.existsSync(this.modelFilePath)) {
        const raw = fs.readFileSync(this.modelFilePath, 'utf8');
        offlineModel.loadJSON(raw);
      }
    } catch {}
  }

  private saveModel() {
    try {
      const dir = path.dirname(this.modelFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.modelFilePath, offlineModel.exportJSON(), 'utf8');
    } catch {}
  }

  private loadRecords() {
    try {
      if (fs.existsSync(this.pipelineFilePath)) {
        const raw = fs.readFileSync(this.pipelineFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.records = parsed;
        }
      }
    } catch {
      this.records = [];
    }
  }

  private saveRecords() {
    try {
      const dir = path.dirname(this.pipelineFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.pipelineFilePath, JSON.stringify(this.records.slice(-500), null, 2), 'utf8');
    } catch {}
  }

  /**
   * Pipeline step: Called after each game/round finish with winner.
   * Ingests the table data sequentially and trains the offline model.
   */
  public ingestFinishedGame(
    tableState: TableState,
    winnerSeatIndex: number,
    playerHands: Map<number, { dealtCards: Card[]; arrangedGroups: any }>,
    playerStrategies: Map<number, ArrangementStrategy>
  ): GamePipelineRecord {
    const winnerPlayer = tableState.players[winnerSeatIndex];
    const winnerHand = playerHands.get(winnerSeatIndex);
    const winnerFeatures = winnerHand ? extractFeatures(winnerHand.dealtCards).normalizedVector : [];
    const winnerStrategy = playerStrategies.get(winnerSeatIndex) || 'optimal_ev';

    const playerRecords = tableState.players.map((p, seat) => {
      const hand = playerHands.get(seat);
      const feat = hand ? extractFeatures(hand.dealtCards).normalizedVector : [];
      return {
        seatIndex: seat,
        playerId: p.id,
        playerName: p.name,
        isAgent: p.isAgent,
        roundScore: p.roundScore,
        cumulativeScore: p.cumulativeScore,
        strategyUsed: playerStrategies.get(seat) || (seat === 0 ? 'optimal_ev' : seat === 1 ? 'aggressive' : seat === 2 ? 'balanced' : 'defensive'),
        features: feat,
      };
    });

    const record: GamePipelineRecord = {
      gameId: `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tableId: tableState.tableId,
      tableName: tableState.tableName,
      timestamp: Date.now(),
      roundNumber: tableState.currentRound,
      winnerSeatIndex,
      winnerName: winnerPlayer.name,
      winnerStrategy,
      winningHandPoints: winnerPlayer.roundScore,
      winningHandFeatures: winnerFeatures,
      playerRecords,
      totalRoundPoints: tableState.players.reduce((sum, p) => sum + p.roundScore, 0),
    };

    // Append to pipeline
    this.records.push(record);
    this.saveRecords();

    // Sequentially train model with the new winner data
    this.trainIncrementally(record);

    return record;
  }

  private trainIncrementally(latestRecord: GamePipelineRecord) {
    // Generate training samples from winning hand & competitive hands
    const samples = this.records.map((r) => ({
      features: r.winningHandFeatures,
      winningStrategy: r.winnerStrategy,
    })).filter((s) => s.features && s.features.length === 10);

    if (samples.length >= 4) {
      const trainResult = offlineModel.train(samples);
      this.saveModel();
      if (this.onModelUpdate) {
        this.onModelUpdate(offlineModel.metadata);
      }
    }
  }

  /**
   * Schedules offline model retraining once per day.
   */
  private initDailyTrainingScheduler() {
    // Check every hour if 24 hours have passed since last training
    this.timer = setInterval(() => {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (now - this.lastDailyTrainTime >= oneDayMs) {
        this.runDailyTraining();
      }
    }, 60 * 60 * 1000);
  }

  public runDailyTraining(): { accuracy: number; sampleCount: number; timestamp: number } {
    this.lastDailyTrainTime = Date.now();

    // Extract all training pairs from historical game records
    const samples = this.records
      .filter((r) => r.winningHandFeatures && r.winningHandFeatures.length === 10)
      .map((r) => ({
        features: r.winningHandFeatures,
        winningStrategy: r.winnerStrategy,
      }));

    // If historical data is small, augment with synthetic simulations
    const effectiveSamples = [...samples];
    if (effectiveSamples.length < 20) {
      effectiveSamples.push(...this.generateBaselineTrainingSamples(60));
    }

    const result = offlineModel.train(effectiveSamples);
    this.saveModel();

    if (this.onModelUpdate) {
      this.onModelUpdate(offlineModel.metadata);
    }

    return {
      accuracy: result.accuracy,
      sampleCount: effectiveSamples.length,
      timestamp: this.lastDailyTrainTime,
    };
  }

  private generateBaselineTrainingSamples(count: number): { features: number[]; winningStrategy: ArrangementStrategy }[] {
    const list: { features: number[]; winningStrategy: ArrangementStrategy }[] = [];
    const strategies: ArrangementStrategy[] = ['aggressive', 'defensive', 'balanced', 'optimal_ev'];

    for (let i = 0; i < count; i++) {
      const strat = strategies[i % strategies.length];
      const feat = [
        strat === 'optimal_ev' ? 0.8 : 0.2, // trioCount
        strat === 'aggressive' ? 0.9 : 0.1, // sameColorRun
        strat === 'aggressive' ? 0.85 : 0.4, // runPotential
        strat === 'balanced' ? 0.75 : 0.3, // colorPotential
        strat === 'defensive' ? 0.9 : 0.2, // pairCount
        0.65, // uniqueRanks
        0.4, // suitVariance
        0.55, // clusteringScore
        strat === 'aggressive' ? 0.9 : 0.5, // handStrengthScore
        strat === 'aggressive' ? 1.0 : 0.0, // weakTrioBreakValue
      ];
      list.push({ features: feat, winningStrategy: strat });
    }
    return list;
  }

  public getPipelineStatus() {
    return {
      totalGamesRecorded: this.records.length,
      modelMetadata: offlineModel.metadata,
      recentGames: this.records.slice(-8).reverse(),
      strategyWinRates: this.calculateStrategyWinRates(),
    };
  }

  private calculateStrategyWinRates(): Record<string, { wins: number; total: number; winPct: number }> {
    const stats: Record<string, { wins: number; total: number; winPct: number }> = {
      optimal_ev: { wins: 0, total: 0, winPct: 0 },
      aggressive: { wins: 0, total: 0, winPct: 0 },
      defensive: { wins: 0, total: 0, winPct: 0 },
      balanced: { wins: 0, total: 0, winPct: 0 },
    };

    for (const r of this.records) {
      const strat = r.winnerStrategy;
      if (stats[strat]) {
        stats[strat].wins++;
      }
      for (const p of r.playerRecords) {
        if (stats[p.strategyUsed]) {
          stats[p.strategyUsed].total++;
        }
      }
    }

    for (const [k, v] of Object.entries(stats)) {
      v.winPct = v.total > 0 ? Number(((v.wins / v.total) * 100).toFixed(1)) : 0;
    }

    return stats;
  }
}
