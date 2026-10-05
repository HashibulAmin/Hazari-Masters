import { Card, Rank, Suit } from './types';

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const RANK_ORDER: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
};

export const CARD_POINTS: Record<Rank, number> = {
  'A': 10,
  'K': 10,
  'Q': 10,
  'J': 10,
  '10': 10,
  '9': 5,
  '8': 5,
  '7': 5,
  '6': 5,
  '5': 5,
  '4': 5,
  '3': 5,
  '2': 5,
};

export function createCard(rank: Rank, suit: Suit): Card {
  return {
    code: `${rank}${suit}`,
    rank,
    suit,
    value: RANK_ORDER[rank],
    points: CARD_POINTS[rank],
  };
}

export function parseCardCode(code: string): Card {
  const suit = code.slice(-1) as Suit;
  const rank = code.slice(0, -1) as Rank;
  return createCard(rank, suit);
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(rank, suit));
    }
  }
  return deck;
}

export function fisherYatesShuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Validates a hand against traditional Hazari dealing criteria:
 * 1. Must contain at least one valid 3-card run (consecutive ranks, with A-2-3 supported).
 * 2. Must not contain more than 6 pairs of ranks.
 */
export function hasRun(hand: Card[]): boolean {
  const values = hand.map((c) => c.value);
  const ranks = hand.map((c) => c.rank);
  const rankSet = new Set(ranks);

  // Check special A-2-3 run
  if (rankSet.has('A') && rankSet.has('2') && rankSet.has('3')) {
    return true;
  }

  // Check all combinations of 3 cards for consecutive ranks
  const uniqueVals = Array.from(new Set(values)).sort((a, b) => a - b);
  for (let i = 0; i < uniqueVals.length - 2; i++) {
    if (uniqueVals[i + 1] === uniqueVals[i] + 1 && uniqueVals[i + 2] === uniqueVals[i] + 2) {
      return true;
    }
  }
  return false;
}

export function countPairs(hand: Card[]): number {
  const counts: Record<string, number> = {};
  for (const card of hand) {
    counts[card.rank] = (counts[card.rank] || 0) + 1;
  }
  let pairs = 0;
  for (const count of Object.values(counts)) {
    pairs += Math.floor(count / 2);
  }
  return pairs;
}

export function isValidHand(hand: Card[]): boolean {
  return hasRun(hand) && countPairs(hand) <= 6;
}

/**
 * Shuffles a 52-card deck using Fisher-Yates and deals 13 cards to 4 players,
 * with rejection sampling as in the original Hazari automation gist.
 */
export function shuffleAndDeal(): Card[][] {
  const baseDeck = createDeck();
  let attempts = 0;
  const maxAttempts = 1000;

  while (attempts < maxAttempts) {
    attempts++;
    const shuffled = fisherYatesShuffle(baseDeck);
    const hands: Card[][] = [
      shuffled.slice(0, 13),
      shuffled.slice(13, 26),
      shuffled.slice(26, 39),
      shuffled.slice(39, 52),
    ];

    if (hands.every(isValidHand)) {
      return hands;
    }
  }

  // Fallback to standard deal if rejection sampling takes more than 1000 tries
  const shuffled = fisherYatesShuffle(baseDeck);
  return [
    shuffled.slice(0, 13),
    shuffled.slice(13, 26),
    shuffled.slice(26, 39),
    shuffled.slice(39, 52),
  ];
}
