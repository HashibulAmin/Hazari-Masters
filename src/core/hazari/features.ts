import { Card } from './types';

export interface HandFeatures {
  trioCount: number;
  sameColorRun: number;
  runPotential: number;
  colorPotential: number;
  pairCount: number;
  uniqueRanks: number;
  suitVariance: number;
  clusteringScore: number;
  handStrengthScore: number;
  weakTrioBreakValue: number;
  normalizedVector: number[];
}

export const FEATURE_NAMES = [
  'trioCount',
  'sameColorRun',
  'runPotential',
  'colorPotential',
  'pairCount',
  'uniqueRanks',
  'suitVariance',
  'clusteringScore',
  'handStrengthScore',
  'weakTrioBreakValue',
] as const;

/**
 * Extracts key strategic features from a 13-card Hazari hand,
 * exactly implementing Md Hashibul Amin's feature representation:
 * 1. Trio Count (Three-of-a-Kind)
 * 2. Same Color Run (Straight Flush Potential)
 * 3. Run Potential (Straight)
 * 4. Color Potential (Flush)
 * 5. Pair Count
 * 6. Unique Ranks Count
 * 7. Suit Variance
 * 8. Clustering Score (sum of squared rank counts)
 * 9. Hand Strength Score (weighted rule-based heuristic)
 * 10. Weak Trio Break Value (whether breaking low rank <= 6 trio creates run/flush)
 */
export function extractFeatures(hand: Card[]): HandFeatures {
  const rankCounts: Record<number, number> = {};
  for (const card of hand) {
    rankCounts[card.value] = (rankCounts[card.value] || 0) + 1;
  }

  // Count groups
  let trioCount = 0;
  let pairCount = 0;
  for (const count of Object.values(rankCounts)) {
    if (count === 3) trioCount++;
    if (count === 2) pairCount++;
  }

  // Unique ranks
  const uniqueRankVals = Object.keys(rankCounts).map(Number).sort((a, b) => a - b);
  const uniqueRanks = uniqueRankVals.length;

  // Check if hand contains a straight sequence of 3 or 4 consecutive ranks (including A-2-3)
  const isStraight = (cards: Card[]): boolean => {
    const vals = Array.from(new Set(cards.map((c) => c.value))).sort((a, b) => a - b);
    if (vals.includes(14) && vals.includes(2) && vals.includes(3)) {
      return true; // Low ace A-2-3
    }
    for (let i = 0; i < vals.length - 2; i++) {
      if (vals[i + 1] === vals[i] + 1 && vals[i + 2] === vals[i] + 1 + 1) {
        return true;
      }
    }
    return false;
  };

  // Check if hand is a color play (at least 3 cards of the same suit)
  const isFlush = (cards: Card[]): boolean => {
    const suitCounts: Record<string, number> = {};
    for (const c of cards) {
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    }
    return Math.max(...Object.values(suitCounts), 0) >= 4;
  };

  // Check for same-color run (straight flush potential)
  const hasStraightFlush = (cards: Card[]): boolean => {
    const suitGroups: Record<string, Card[]> = {};
    for (const c of cards) {
      if (!suitGroups[c.suit]) suitGroups[c.suit] = [];
      suitGroups[c.suit].push(c);
    }
    for (const group of Object.values(suitGroups)) {
      if (group.length >= 3 && isStraight(group)) {
        return true;
      }
    }
    return false;
  };

  const runPotential = isStraight(hand) ? 1 : 0;
  const colorPotential = isFlush(hand) ? 1 : 0;
  const sameColorRun = hasStraightFlush(hand) ? 1 : 0;

  // Suit variance
  const suitCounts: Record<string, number> = { '♠': 0, '♥': 0, '♦': 0, '♣': 0 };
  for (const c of hand) {
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  }
  const sCounts = Object.values(suitCounts);
  const meanSuit = sCounts.reduce((a, b) => a + b, 0) / sCounts.length;
  const suitVariance = sCounts.reduce((a, b) => a + Math.pow(b - meanSuit, 2), 0) / sCounts.length;

  // Clustering score
  const clusteringScore = Object.values(rankCounts).reduce((sum, count) => sum + count * count, 0);

  // Weak Trio Breaking Consideration:
  // If we have a low-value trio (rank <= 6), check if breaking it allows a straight or flush
  let weakTrioBreakValue = 0;
  if (trioCount > 0) {
    for (const [rankStr, count] of Object.entries(rankCounts)) {
      const r = Number(rankStr);
      if (count === 3 && r <= 6) {
        const tempHand = hand.filter((c) => c.value !== r);
        if (isStraight(tempHand) || isFlush(tempHand)) {
          weakTrioBreakValue = 1;
          break;
        }
      }
    }
  }

  // Hand Strength Score (weighted for Hazari rules)
  const handStrengthScore =
    trioCount * 5 +
    sameColorRun * 4 +
    runPotential * 3 +
    colorPotential * 2 +
    pairCount * 1 +
    weakTrioBreakValue * 2;

  const rawFeatures = [
    trioCount,
    sameColorRun,
    runPotential,
    colorPotential,
    pairCount,
    uniqueRanks,
    Number(suitVariance.toFixed(3)),
    clusteringScore,
    handStrengthScore,
    weakTrioBreakValue,
  ];

  // Min-max / magnitude normalization
  const maxVal = Math.max(...rawFeatures, 1);
  const normalizedVector = rawFeatures.map((v) => Number((v / maxVal).toFixed(4)));

  return {
    trioCount,
    sameColorRun,
    runPotential,
    colorPotential,
    pairCount,
    uniqueRanks,
    suitVariance,
    clusteringScore,
    handStrengthScore,
    weakTrioBreakValue,
    normalizedVector,
  };
}
