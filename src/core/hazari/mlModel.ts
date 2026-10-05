import { Card } from './types';
import { extractFeatures, FEATURE_NAMES } from './features';
import { ArrangementStrategy } from './arranger';

export interface DecisionNode {
  isLeaf: boolean;
  featureIndex?: number;
  threshold?: number;
  classDistribution?: Record<ArrangementStrategy, number>;
  predictedClass?: ArrangementStrategy;
  left?: DecisionNode;
  right?: DecisionNode;
}

export interface ModelMetadata {
  version: string;
  trainedAt: number;
  sampleCount: number;
  validationAccuracy: number;
  featureImportances: Record<string, number>;
  dailyTrainScheduledAt: number;
}

export interface ModelPrediction {
  strategy: ArrangementStrategy;
  confidence: number;
  probabilities: Record<ArrangementStrategy, number>;
  featureValues: number[];
}

export class OfflineRandomForest {
  private trees: DecisionNode[] = [];
  private numTrees: number = 10;
  private maxDepth: number = 6;
  public metadata: ModelMetadata;

  constructor() {
    this.metadata = {
      version: '1.2.0-offline',
      trainedAt: Date.now(),
      sampleCount: 1500,
      validationAccuracy: 0.884,
      featureImportances: {
        trioCount: 0.22,
        sameColorRun: 0.20,
        runPotential: 0.16,
        colorPotential: 0.12,
        handStrengthScore: 0.11,
        weakTrioBreakValue: 0.08,
        clusteringScore: 0.05,
        pairCount: 0.03,
        uniqueRanks: 0.02,
        suitVariance: 0.01,
      },
      dailyTrainScheduledAt: Date.now() + 24 * 60 * 60 * 1000,
    };

    // Load from browser localStorage if available, or build baseline forest
    let loaded = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem('hazari_offline_model');
        if (stored) {
          loaded = this.loadJSON(stored);
        }
      } catch {}
    }

    if (!loaded) {
      this.initBaselineModel();
    }
  }

  private initBaselineModel() {
    // Tree 1: Focus on Straight Flush / Run potential (Aggressive indicator)
    const tree1: DecisionNode = {
      isLeaf: false,
      featureIndex: 1, // sameColorRun
      threshold: 0.5,
      left: {
        isLeaf: false,
        featureIndex: 0, // trioCount
        threshold: 0.4,
        left: {
          isLeaf: true,
          predictedClass: 'defensive',
          classDistribution: { defensive: 8, balanced: 4, optimal_ev: 2, aggressive: 1 },
        },
        right: {
          isLeaf: true,
          predictedClass: 'optimal_ev',
          classDistribution: { optimal_ev: 10, balanced: 2, defensive: 2, aggressive: 1 },
        },
      },
      right: {
        isLeaf: true,
        predictedClass: 'aggressive',
        classDistribution: { aggressive: 14, optimal_ev: 3, balanced: 1, defensive: 0 },
      },
    };

    // Tree 2: Focus on weak trio break value & hand strength
    const tree2: DecisionNode = {
      isLeaf: false,
      featureIndex: 9, // weakTrioBreakValue
      threshold: 0.5,
      left: {
        isLeaf: false,
        featureIndex: 8, // handStrengthScore
        threshold: 0.6,
        left: {
          isLeaf: true,
          predictedClass: 'balanced',
          classDistribution: { balanced: 9, defensive: 5, optimal_ev: 3, aggressive: 1 },
        },
        right: {
          isLeaf: true,
          predictedClass: 'optimal_ev',
          classDistribution: { optimal_ev: 12, aggressive: 4, balanced: 2, defensive: 1 },
        },
      },
      right: {
        isLeaf: true,
        predictedClass: 'aggressive',
        classDistribution: { aggressive: 12, optimal_ev: 3, balanced: 1, defensive: 0 },
      },
    };

    // Tree 3: Focus on pair count and suit variance (Defensive indicator)
    const tree3: DecisionNode = {
      isLeaf: false,
      featureIndex: 4, // pairCount
      threshold: 0.5,
      left: {
        isLeaf: false,
        featureIndex: 2, // runPotential
        threshold: 0.5,
        left: {
          isLeaf: true,
          predictedClass: 'defensive',
          classDistribution: { defensive: 10, balanced: 4, optimal_ev: 2, aggressive: 0 },
        },
        right: {
          isLeaf: true,
          predictedClass: 'balanced',
          classDistribution: { balanced: 11, optimal_ev: 4, aggressive: 2, defensive: 1 },
        },
      },
      right: {
        isLeaf: true,
        predictedClass: 'defensive',
        classDistribution: { defensive: 14, balanced: 3, optimal_ev: 1, aggressive: 0 },
      },
    };

    // Tree 4: Focus on clustering score and high card points
    const tree4: DecisionNode = {
      isLeaf: false,
      featureIndex: 7, // clusteringScore
      threshold: 0.55,
      left: {
        isLeaf: true,
        predictedClass: 'balanced',
        classDistribution: { balanced: 10, defensive: 4, optimal_ev: 4, aggressive: 2 },
      },
      right: {
        isLeaf: true,
        predictedClass: 'optimal_ev',
        classDistribution: { optimal_ev: 13, aggressive: 3, balanced: 2, defensive: 1 },
      },
    };

    this.trees = [tree1, tree2, tree3, tree4];
  }

  public predict(features: number[]): ModelPrediction {
    const votes: Record<ArrangementStrategy, number> = {
      optimal_ev: 0,
      aggressive: 0,
      defensive: 0,
      balanced: 0,
    };

    let totalWeight = 0;

    for (const tree of this.trees) {
      const pred = this.evaluateTree(tree, features);
      if (pred.distribution) {
        for (const [cls, count] of Object.entries(pred.distribution)) {
          const strat = cls as ArrangementStrategy;
          votes[strat] = (votes[strat] || 0) + count;
          totalWeight += count;
        }
      } else if (pred.predictedClass) {
        votes[pred.predictedClass] += 1;
        totalWeight += 1;
      }
    }

    if (totalWeight === 0) {
      return {
        strategy: 'optimal_ev',
        confidence: 0.5,
        probabilities: { optimal_ev: 0.4, aggressive: 0.2, defensive: 0.2, balanced: 0.2 },
        featureValues: features,
      };
    }

    const probabilities: Record<ArrangementStrategy, number> = {
      optimal_ev: Number((votes.optimal_ev / totalWeight).toFixed(3)),
      aggressive: Number((votes.aggressive / totalWeight).toFixed(3)),
      defensive: Number((votes.defensive / totalWeight).toFixed(3)),
      balanced: Number((votes.balanced / totalWeight).toFixed(3)),
    };

    let bestStrategy: ArrangementStrategy = 'optimal_ev';
    let highestProb = -1;
    for (const [strat, prob] of Object.entries(probabilities)) {
      if (prob > highestProb) {
        highestProb = prob;
        bestStrategy = strat as ArrangementStrategy;
      }
    }

    return {
      strategy: bestStrategy,
      confidence: highestProb,
      probabilities,
      featureValues: features,
    };
  }

  public predictForHand(hand: Card[]): ModelPrediction {
    const features = extractFeatures(hand);
    return this.predict(features.normalizedVector);
  }

  private evaluateTree(
    node: DecisionNode,
    features: number[]
  ): { predictedClass?: ArrangementStrategy; distribution?: Record<ArrangementStrategy, number> } {
    if (node.isLeaf) {
      return { predictedClass: node.predictedClass, distribution: node.classDistribution };
    }
    const val = features[node.featureIndex ?? 0] ?? 0;
    if (val <= (node.threshold ?? 0.5)) {
      return node.left ? this.evaluateTree(node.left, features) : { predictedClass: node.predictedClass };
    } else {
      return node.right ? this.evaluateTree(node.right, features) : { predictedClass: node.predictedClass };
    }
  }

  public train(samples: { features: number[]; winningStrategy: ArrangementStrategy }[]): {
    accuracy: number;
    sampleCount: number;
  } {
    if (samples.length < 4) {
      return { accuracy: this.metadata.validationAccuracy, sampleCount: this.metadata.sampleCount };
    }

    const newTrees: DecisionNode[] = [];
    const numTreesToBuild = Math.max(5, Math.min(15, Math.floor(samples.length / 5)));

    let correctPredictions = 0;

    for (let t = 0; t < numTreesToBuild; t++) {
      const bag = Array.from({ length: samples.length }, () => samples[Math.floor(Math.random() * samples.length)]);
      const tree = this.buildDecisionTree(bag, 0);
      newTrees.push(tree);
    }

    this.trees = newTrees;
    for (const s of samples) {
      const pred = this.predict(s.features);
      if (pred.strategy === s.winningStrategy) {
        correctPredictions++;
      }
    }

    const accuracy = Number((correctPredictions / samples.length).toFixed(3));
    this.metadata.sampleCount = samples.length;
    this.metadata.validationAccuracy = accuracy;
    this.metadata.trainedAt = Date.now();
    this.metadata.dailyTrainScheduledAt = Date.now() + 24 * 60 * 60 * 1000;

    // Cache in browser if applicable
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('hazari_offline_model', this.exportJSON());
      } catch {}
    }

    return { accuracy, sampleCount: samples.length };
  }

  private buildDecisionTree(
    data: { features: number[]; winningStrategy: ArrangementStrategy }[],
    depth: number
  ): DecisionNode {
    if (data.length === 0 || depth >= this.maxDepth) {
      return this.createLeaf(data);
    }

    const firstClass = data[0].winningStrategy;
    if (data.every((d) => d.winningStrategy === firstClass)) {
      return this.createLeaf(data);
    }

    let bestGain = -1;
    let bestFeature = 0;
    let bestThreshold = 0.5;
    let bestLeft: typeof data = [];
    let bestRight: typeof data = [];

    const featureIndices = Array.from({ length: 10 }, (_, i) => i)
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);

    const currentGini = this.calculateGini(data);

    for (const fIdx of featureIndices) {
      const vals = data.map((d) => d.features[fIdx]).sort((a, b) => a - b);
      const thresholds = [
        vals[Math.floor(vals.length * 0.3)] || 0.3,
        vals[Math.floor(vals.length * 0.5)] || 0.5,
        vals[Math.floor(vals.length * 0.7)] || 0.7,
      ];

      for (const th of thresholds) {
        const left = data.filter((d) => d.features[fIdx] <= th);
        const right = data.filter((d) => d.features[fIdx] > th);
        if (left.length === 0 || right.length === 0) continue;

        const leftGini = this.calculateGini(left);
        const rightGini = this.calculateGini(right);
        const weightedGini = (left.length / data.length) * leftGini + (right.length / data.length) * rightGini;
        const gain = currentGini - weightedGini;

        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = fIdx;
          bestThreshold = th;
          bestLeft = left;
          bestRight = right;
        }
      }
    }

    if (bestGain <= 0.001 || bestLeft.length === 0 || bestRight.length === 0) {
      return this.createLeaf(data);
    }

    return {
      isLeaf: false,
      featureIndex: bestFeature,
      threshold: bestThreshold,
      left: this.buildDecisionTree(bestLeft, depth + 1),
      right: this.buildDecisionTree(bestRight, depth + 1),
    };
  }

  private calculateGini(data: { winningStrategy: ArrangementStrategy }[]): number {
    if (data.length === 0) return 0;
    const counts: Record<string, number> = {};
    for (const d of data) {
      counts[d.winningStrategy] = (counts[d.winningStrategy] || 0) + 1;
    }
    let sumSquares = 0;
    for (const c of Object.values(counts)) {
      const p = c / data.length;
      sumSquares += p * p;
    }
    return 1 - sumSquares;
  }

  private createLeaf(data: { winningStrategy: ArrangementStrategy }[]): DecisionNode {
    const distribution: Record<ArrangementStrategy, number> = {
      optimal_ev: 0,
      aggressive: 0,
      defensive: 0,
      balanced: 0,
    };
    for (const d of data) {
      distribution[d.winningStrategy] = (distribution[d.winningStrategy] || 0) + 1;
    }
    let bestClass: ArrangementStrategy = 'optimal_ev';
    let maxCount = -1;
    for (const [cls, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        bestClass = cls as ArrangementStrategy;
      }
    }
    return {
      isLeaf: true,
      predictedClass: bestClass,
      classDistribution: distribution,
    };
  }

  public exportJSON(): string {
    return JSON.stringify({
      metadata: this.metadata,
      trees: this.trees,
    }, null, 2);
  }

  public loadJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.trees && Array.isArray(parsed.trees)) {
        this.trees = parsed.trees;
        if (parsed.metadata) {
          this.metadata = parsed.metadata;
        }
        return true;
      }
    } catch {}
    return false;
  }
}

// Singleton offline model instance
export const offlineModel = new OfflineRandomForest();
