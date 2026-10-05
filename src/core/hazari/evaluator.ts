import { Card, CombinationRank, EvaluationResult } from './types';

export function compareTuples(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const valA = a[i] ?? -1;
    const valB = b[i] ?? -1;
    if (valA !== valB) {
      return valA - valB;
    }
  }
  return 0;
}

/**
 * Evaluates a 3-card group according to standard Hazari rules:
 * 6: Trio (Three of a Kind)
 * 5: Colour Run (Straight Flush)
 * 4: Run (Straight)
 * 3: Colour (Flush)
 * 2: Pair
 * 1: Indi (High Card)
 */
export function evaluate3CardGroup(cards: Card[]): EvaluationResult {
  if (cards.length !== 3) {
    throw new Error(`Expected 3 cards for evaluate3CardGroup, got ${cards.length}`);
  }

  const vals = cards.map((c) => c.value);
  const suits = cards.map((c) => c.suit);
  const sortedVals = [...vals].sort((a, b) => b - a);
  const points = cards.reduce((sum, c) => sum + c.points, 0);

  // 1. Trio (all 3 cards have the same rank)
  if (vals[0] === vals[1] && vals[1] === vals[2]) {
    const rankName = cards[0].rank;
    return {
      category: CombinationRank.TROY,
      categoryName: 'Troy',
      comparisonTuple: [6, vals[0]],
      label: `Troy (${rankName}-${rankName}-${rankName})`,
      points,
    };
  }

  // Helper for consecutive descending sequence
  const isConsecutive = (seq: number[]) => seq[0] - seq[1] === 1 && seq[1] - seq[2] === 1;

  // Run candidates (standard run & A-2-3 low ace run)
  interface RunCandidate {
    highVal: number;
    isLowAce: boolean;
  }
  const runCandidates: RunCandidate[] = [];

  if (isConsecutive(sortedVals)) {
    runCandidates.push({ highVal: sortedVals[0], isLowAce: false });
  }

  if (vals.includes(14)) {
    // Treat Ace as 1
    const lowVals = vals.map((v) => (v === 14 ? 1 : v)).sort((a, b) => b - a);
    if (isConsecutive(lowVals)) {
      // In Hazari, A-2-3 is considered a valid run with top value 3
      runCandidates.push({ highVal: 3, isLowAce: true });
    }
  }

  const isSameSuit = suits[0] === suits[1] && suits[1] === suits[2];

  if (runCandidates.length > 0) {
    const bestRun = runCandidates.find((r) => !r.isLowAce) || runCandidates[0];
    const category = isSameSuit ? CombinationRank.COLOUR_RUN : CombinationRank.RUN;
    const catName = isSameSuit ? 'Colour Run' : 'Run';
    const cardStr = cards.map((c) => c.code).join(' ');

    return {
      category,
      categoryName: catName,
      comparisonTuple: [category, bestRun.highVal],
      label: `${catName} (${cardStr})`,
      points,
    };
  }

  // 3. Colour (Flush: all 3 same suit, not consecutive)
  if (isSameSuit) {
    return {
      category: CombinationRank.COLOUR,
      categoryName: 'Colour',
      comparisonTuple: [3, ...sortedVals],
      label: `Colour (${suits[0]} - High ${cards.find((c) => c.value === sortedVals[0])?.rank})`,
      points,
    };
  }

  // 4. Pair (two cards of the same rank)
  for (const r of Array.from(new Set(vals))) {
    if (vals.filter((v) => v === r).length === 2) {
      const kicker = Math.max(...vals.filter((v) => v !== r));
      const pairCard = cards.find((c) => c.value === r);
      return {
        category: CombinationRank.PAIR,
        categoryName: 'Pair',
        comparisonTuple: [2, r, kicker],
        label: `Pair of ${pairCard?.rank}s`,
        points,
      };
    }
  }

  // 5. Indi / High Card
  return {
    category: CombinationRank.INDI,
    categoryName: 'Indi',
    comparisonTuple: [1, ...sortedVals],
    label: `Indi (High ${cards.find((c) => c.value === sortedVals[0])?.rank})`,
    points,
  };
}

/**
 * Updated Extra (4-Card) Group Evaluator from Md Hashibul Amin's script:
 *
 * Considers all 4 three-card subsets within the 4 cards and computes evaluate_group
 * on each. The best 3-card evaluation is then enhanced by appending the rank of the
 * remaining 4th card as a tiebreaker.
 *
 * This allows the extra group to score runs, flushes, trios, and pairs rather than
 * only high cards!
 */
export function evaluateExtraGroup(cards: Card[]): EvaluationResult {
  if (cards.length !== 4) {
    // Fallback if not 4
    if (cards.length === 3) return evaluate3CardGroup(cards);
    const sortedVals = cards.map((c) => c.value).sort((a, b) => b - a);
    return {
      category: CombinationRank.INDI,
      categoryName: 'Extra Group',
      comparisonTuple: [1, ...sortedVals],
      label: `Cards (${cards.map((c) => c.code).join(' ')})`,
      points: cards.reduce((sum, c) => sum + c.points, 0),
    };
  }

  const points = cards.reduce((sum, c) => sum + c.points, 0);

  // Evaluate all 4 subsets of 3 cards from the 4 cards:
  const subsets3: { subset: Card[]; remaining: Card }[] = [
    { subset: [cards[0], cards[1], cards[2]], remaining: cards[3] },
    { subset: [cards[0], cards[1], cards[3]], remaining: cards[2] },
    { subset: [cards[0], cards[2], cards[3]], remaining: cards[1] },
    { subset: [cards[1], cards[2], cards[3]], remaining: cards[0] },
  ];

  let bestEval: EvaluationResult | null = null;
  let bestRemaining: Card = cards[3];

  for (const item of subsets3) {
    const curEval = evaluate3CardGroup(item.subset);
    if (!bestEval || compareGroupEvaluations(curEval, bestEval) > 0) {
      bestEval = curEval;
      bestRemaining = item.remaining;
    }
  }

  // Append remaining 4th card rank value as tiebreaker
  const comparisonTuple = [...(bestEval?.comparisonTuple || [1]), bestRemaining.value];

  return {
    category: bestEval?.category || CombinationRank.INDI,
    categoryName: bestEval ? `4-Card ${bestEval.categoryName}` : 'Extra 4-Card',
    comparisonTuple,
    label: `${bestEval?.label} + ${bestRemaining.code} kicker`,
    points,
  };
}

export function evaluateGroup(cards: Card[]): EvaluationResult {
  if (cards.length === 3) {
    return evaluate3CardGroup(cards);
  }
  return evaluateExtraGroup(cards);
}

export function compareGroupEvaluations(a: EvaluationResult, b: EvaluationResult): number {
  return compareTuples(a.comparisonTuple, b.comparisonTuple);
}
