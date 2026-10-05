import { evaluate3CardGroup, evaluateExtraGroup, compareGroupEvaluations, compareTuples } from './evaluator';
import { Card, HandGroups, EvaluationResult, CombinationRank } from './types';
import { extractFeatures } from './features';

export type ArrangementStrategy = 'optimal_ev' | 'aggressive' | 'defensive' | 'balanced';

export interface ArrangementAnalysis {
  strategy: ArrangementStrategy;
  groups: HandGroups;
  evaluations: [EvaluationResult, EvaluationResult, EvaluationResult, EvaluationResult];
  winProbabilities: [number, number, number, number]; // 0 to 100%
  expectedPoints: number;
  totalPoints: number;
  summary: string;
}

export interface ArrangementValidation {
  isValid: boolean;
  error?: string;
  eval1?: EvaluationResult;
  eval2?: EvaluationResult;
  eval3?: EvaluationResult;
  eval4?: EvaluationResult;
}

export function validateArrangement(groups: HandGroups): ArrangementValidation {
  const { group1, group2, group3, group4 } = groups;

  if (group1.length !== 3) {
    return { isValid: false, error: 'Group 1 must have exactly 3 cards.' };
  }
  if (group2.length !== 3) {
    return { isValid: false, error: 'Group 2 must have exactly 3 cards.' };
  }
  if (group3.length !== 3) {
    return { isValid: false, error: 'Group 3 must have exactly 3 cards.' };
  }
  if (group4.length !== 4) {
    return { isValid: false, error: 'Group 4 must have exactly 4 cards.' };
  }

  const allCodes = [...group1, ...group2, ...group3, ...group4].map((c) => c.code);
  if (new Set(allCodes).size !== 13) {
    return { isValid: false, error: 'Each of the 13 cards must be uniquely placed.' };
  }

  const eval1 = evaluate3CardGroup(group1);
  const eval2 = evaluate3CardGroup(group2);
  const eval3 = evaluate3CardGroup(group3);
  const eval4 = evaluateExtraGroup(group4);

  // Group 1 must be >= Group 2 in Hazari
  if (compareGroupEvaluations(eval1, eval2) < 0) {
    return {
      isValid: false,
      error: `Group 1 (${eval1.categoryName}) cannot be weaker than Group 2 (${eval2.categoryName}). In Hazari, groups must be descending.`,
      eval1,
      eval2,
      eval3,
      eval4,
    };
  }

  // Group 2 must be >= Group 3 in Hazari
  if (compareGroupEvaluations(eval2, eval3) < 0) {
    return {
      isValid: false,
      error: `Group 2 (${eval2.categoryName}) cannot be weaker than Group 3 (${eval3.categoryName}). In Hazari, groups must be descending.`,
      eval1,
      eval2,
      eval3,
      eval4,
    };
  }

  return {
    isValid: true,
    eval1,
    eval2,
    eval3,
    eval4,
  };
}

export function estimate3CardWinRate(ev: EvaluationResult): number {
  switch (ev.category) {
    case CombinationRank.TROY:
      return 0.98 + (ev.comparisonTuple[1] / 14) * 0.019;
    case CombinationRank.COLOUR_RUN:
      return 0.88 + (ev.comparisonTuple[1] / 14) * 0.09;
    case CombinationRank.RUN:
      return 0.72 + (ev.comparisonTuple[1] / 14) * 0.14;
    case CombinationRank.COLOUR:
      return 0.55 + (ev.comparisonTuple[1] / 14) * 0.16;
    case CombinationRank.PAIR:
      return 0.26 + (ev.comparisonTuple[1] / 14) * 0.24;
    case CombinationRank.INDI:
    default:
      return 0.05 + (ev.comparisonTuple[1] / 14) * 0.15;
  }
}

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

interface TripletCandidate {
  indices: number[];
  bitmask: number;
  eval: EvaluationResult;
  points: number;
  winRate: number;
  highCardsCount: number;
  colorScore: number;
  isRedColor: boolean;
  isBlackColor: boolean;
}

/**
 * Updated Hazari Optimal Arrangement Algorithm (incorporating Md Hashibul Amin's model):
 *
 * Distinct logic based on Mode:
 * - 'aggressive':
 *     Breaks weak trios/pairs (<=7) to form Straight Flushes & high Runs.
 *     Front-loads max firepower into Group 1 & 2 to seize Trick 1.
 * - 'defensive':
 *     Protects trios and pairs, shielding high-point cards (10, J, Q, K, A) in winning groups.
 *     Minimizes points sacrificed in Group 3 & 4.
 * - 'balanced':
 *     Balances strength and color groups evenly across the 4 tricks.
 * - 'optimal_ev':
 *     Expected Value maximization based on Monte Carlo probability models.
 */
export function autoArrangeHand(
  hand: Card[],
  strategy: ArrangementStrategy = 'optimal_ev'
): ArrangementAnalysis {
  if (hand.length !== 13) {
    throw new Error(`Expected 13 cards, received ${hand.length}`);
  }

  const indices = Array.from({ length: 13 }, (_, i) => i);
  const indexCombos = combinations(indices, 3); // 286 combos

  const redCardsCount = hand.filter((c) => c.suit === '♥' || c.suit === '♦').length;
  const blackCardsCount = hand.length - redCardsCount;

  const allTriplets: TripletCandidate[] = [];
  for (const idxs of indexCombos) {
    let bitmask = 0;
    const cards: Card[] = [];
    for (const idx of idxs) {
      bitmask |= 1 << idx;
      cards.push(hand[idx]);
    }
    const ev = evaluate3CardGroup(cards);
    const pts = cards.reduce((sum, c) => sum + c.points, 0);
    const winRate = estimate3CardWinRate(ev);
    const highCardsCount = cards.filter((c) => c.value >= 10).length;

    const redInCombo = cards.filter((c) => c.suit === '♥' || c.suit === '♦').length;
    const blackInCombo = cards.length - redInCombo;
    const colorScore = Math.max(redInCombo, blackInCombo);

    allTriplets.push({
      indices: idxs,
      bitmask,
      eval: ev,
      points: pts,
      winRate,
      highCardsCount,
      colorScore,
      isRedColor: redInCombo === 3,
      isBlackColor: blackInCombo === 3,
    });
  }

  // Sort candidate triplets
  allTriplets.sort((a, b) => compareTuples(b.eval.comparisonTuple, a.eval.comparisonTuple));

  // Pruning: top 110 candidates give broad exploration across strategies
  const candidates = allTriplets.length > 110 ? allTriplets.slice(0, 110) : allTriplets;

  let bestPartition: [Card[], Card[], Card[], Card[]] | null = null;
  let bestScore = -Infinity;
  let bestEvals: [EvaluationResult, EvaluationResult, EvaluationResult, EvaluationResult] | null = null;
  let bestWinRates: [number, number, number, number] = [0, 0, 0, 0];

  const estimatedOpponentPot = 65;

  for (let i = 0; i < candidates.length; i++) {
    const c1 = candidates[i];

    for (let j = i + 1; j < candidates.length; j++) {
      const c2 = candidates[j];
      if ((c1.bitmask & c2.bitmask) !== 0) continue;

      const mask12 = c1.bitmask | c2.bitmask;

      for (let k = j + 1; k < candidates.length; k++) {
        const c3 = candidates[k];
        if ((mask12 & c3.bitmask) !== 0) continue;

        const totalUsedMask = mask12 | c3.bitmask;

        // Group 4 cards (remaining 4 indices)
        const g4Cards: Card[] = [];
        for (let idx = 0; idx < 13; idx++) {
          if ((totalUsedMask & (1 << idx)) === 0) {
            g4Cards.push(hand[idx]);
          }
        }
        const ev4 = evaluateExtraGroup(g4Cards);
        const pts4 = g4Cards.reduce((sum, c) => sum + c.points, 0);
        const winRate4 = ev4.category >= CombinationRank.PAIR ? 0.48 : 0.16;

        // Sort the three 3-card groups descending:
        const sortedTriplets = [c1, c2, c3].sort((a, b) =>
          compareTuples(b.eval.comparisonTuple, a.eval.comparisonTuple)
        );

        const t1 = sortedTriplets[0];
        const t2 = sortedTriplets[1];
        const t3 = sortedTriplets[2];

        let score = 0;

        if (strategy === 'aggressive') {
          // Aggressive Lead Strategy:
          // Heavily prioritizes winning Trick 1 and Trick 2 with high combos (Straight Flush, Run, Trio).
          // Encourages breaking weak low trios/pairs if it boosts Group 1/2.
          const g1Bonus = t1.eval.category >= CombinationRank.COLOUR_RUN ? 120 : t1.eval.category >= CombinationRank.RUN ? 70 : 0;
          const g2Bonus = t2.eval.category >= CombinationRank.RUN ? 45 : 0;
          const highLeadMultiplier = 2.4;
          score =
            t1.winRate * 250 * highLeadMultiplier +
            t2.winRate * 140 +
            t3.winRate * 40 +
            winRate4 * 35 +
            t1.points * 1.5 +
            g1Bonus +
            g2Bonus;
        } else if (strategy === 'defensive') {
          // Defensive / Point Shield Strategy:
          // Strictly penalizes placing 10-point cards in groups likely to lose (< 60% win rate).
          // Rewards shielding high points in Group 1 & 2.
          // Dumps 5-point cards into Group 3 and 4.
          const shield1 = t1.winRate >= 0.7 ? t1.points * 3.0 : -t1.points * 2.2;
          const shield2 = t2.winRate >= 0.6 ? t2.points * 2.5 : -t2.points * 2.0;
          const shield3 = t3.winRate >= 0.5 ? t3.points * 1.8 : -t3.points * 2.5;
          const shield4 = winRate4 >= 0.4 ? pts4 * 1.5 : -pts4 * 2.8; // Avoid high points in extra group

          // Bonus for preserving trios/pairs (not breaking)
          const pairPreserveBonus = (t1.eval.category === CombinationRank.PAIR ? 25 : 0) + (t2.eval.category === CombinationRank.PAIR ? 20 : 0);

          score = shield1 + shield2 + shield3 + shield4 + (t1.winRate * 80 + t2.winRate * 70) + pairPreserveBonus;
        } else if (strategy === 'balanced') {
          // Balanced Strategy:
          // Avoids putting all power in Group 1; aims for multi-trick viability (e.g. Group 2 & Group 3 having decent win rates).
          // Promotes color symmetry and even distribution.
          const colorHarmony = (t1.colorScore + t2.colorScore + t3.colorScore) * 6;
          const multiTrickViability = (t1.winRate > 0.5 ? 40 : 0) + (t2.winRate > 0.45 ? 50 : 0) + (t3.winRate > 0.35 ? 45 : 0);
          score =
            t1.winRate * 80 +
            t2.winRate * 120 +
            t3.winRate * 130 +
            winRate4 * 70 +
            (t1.points + t2.points + t3.points) * 0.8 +
            colorHarmony +
            multiTrickViability;
        } else {
          // 'optimal_ev' (EV Grandmaster Strategy):
          // Mathematical Expected Value = P(win) * (OpponentPot + MyPoints) - (1 - P(win)) * MyPoints
          const ev1 = t1.winRate * (estimatedOpponentPot + t1.points) - (1 - t1.winRate) * t1.points;
          const ev2 = t2.winRate * (estimatedOpponentPot + t2.points) - (1 - t2.winRate) * t2.points;
          const ev3 = t3.winRate * (estimatedOpponentPot + t3.points) - (1 - t3.winRate) * t3.points;
          const ev4 = winRate4 * (estimatedOpponentPot + pts4) - (1 - winRate4) * pts4;
          const topBonus = t1.eval.category >= CombinationRank.COLOUR_RUN ? 35 : 0;
          score = ev1 + ev2 + ev3 + ev4 + topBonus;
        }

        if (score > bestScore) {
          bestScore = score;
          const g1 = t1.indices.map((idx) => hand[idx]);
          const g2 = t2.indices.map((idx) => hand[idx]);
          const g3 = t3.indices.map((idx) => hand[idx]);

          bestPartition = [g1, g2, g3, g4Cards];
          bestEvals = [t1.eval, t2.eval, t3.eval, ev4];
          bestWinRates = [
            Math.round(t1.winRate * 100),
            Math.round(t2.winRate * 100),
            Math.round(t3.winRate * 100),
            Math.round(winRate4 * 100),
          ];
        }
      }
    }
  }

  if (!bestPartition || !bestEvals) {
    const sortedHand = [...hand].sort((a, b) => b.value - a.value);
    const g1 = sortedHand.slice(0, 3);
    const g2 = sortedHand.slice(3, 6);
    const g3 = sortedHand.slice(6, 9);
    const g4 = sortedHand.slice(9, 13);
    bestPartition = [g1, g2, g3, g4];
    bestEvals = [
      evaluate3CardGroup(g1),
      evaluate3CardGroup(g2),
      evaluate3CardGroup(g3),
      evaluateExtraGroup(g4),
    ];
  }

  const groups: HandGroups = {
    group1: bestPartition[0],
    group2: bestPartition[1],
    group3: bestPartition[2],
    group4: bestPartition[3],
  };

  const totalPoints = hand.reduce((sum, c) => sum + c.points, 0);

  // Generate tactical summary based on the active strategy
  let summary = '';
  switch (strategy) {
    case 'aggressive':
      summary = `Aggressive Lead: Stacked Group 1 with ${bestEvals[0].categoryName} (${bestWinRates[0]}% win rate). Aiming to seize table lead immediately.`;
      break;
    case 'defensive':
      summary = `Defensive Point Shield: Preserved combinations. Dumped low-point cards in Group 3 & 4 to prevent opponent point harvesting.`;
      break;
    case 'balanced':
      summary = `Balanced Attack: Strength distributed across Groups 1 & 2 for multiple trick captures (${bestWinRates[0]}% / ${bestWinRates[1]}%).`;
      break;
    case 'optimal_ev':
    default:
      summary = `EV Grandmaster: Mathematically optimized Expected Value (${Math.round(bestScore)} EV). Total hand value: ${totalPoints} pts.`;
      break;
  }

  return {
    strategy,
    groups,
    evaluations: bestEvals,
    winProbabilities: bestWinRates,
    expectedPoints: Math.round(bestScore),
    totalPoints,
    summary,
  };
}

export function findOptimalArrangement(hand: Card[], strategy: ArrangementStrategy = 'optimal_ev'): HandGroups {
  return autoArrangeHand(hand, strategy).groups;
}

export function autoSortPlayerGroups(groups: HandGroups): HandGroups {
  const g1Eval = evaluate3CardGroup(groups.group1);
  const g2Eval = evaluate3CardGroup(groups.group2);
  const g3Eval = evaluate3CardGroup(groups.group3);

  const sorted3 = [
    { cards: groups.group1, ev: g1Eval },
    { cards: groups.group2, ev: g2Eval },
    { cards: groups.group3, ev: g3Eval },
  ].sort((a, b) => compareTuples(b.ev.comparisonTuple, a.ev.comparisonTuple));

  return {
    group1: sorted3[0].cards,
    group2: sorted3[1].cards,
    group3: sorted3[2].cards,
    group4: groups.group4,
  };
}
