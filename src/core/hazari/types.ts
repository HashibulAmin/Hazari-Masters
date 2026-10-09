export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  code: string; // e.g., "A♠", "10♥"
  rank: Rank;
  suit: Suit;
  value: number; // 2 - 14 (A=14)
  points: number; // 10 for A, K, Q, J, 10; 5 for 2-9
}

export enum CombinationRank {
  INDI = 1,
  PAIR = 2,
  COLOUR = 3,
  RUN = 4,
  COLOUR_RUN = 5,
  TROY = 6,
}

export interface EvaluationResult {
  category: CombinationRank;
  categoryName: string;
  // High-to-low numeric tuple used for exact lexicographical comparison:
  comparisonTuple: number[];
  label: string;
  points: number;
}

export interface HandGroups {
  group1: Card[]; // 3 cards
  group2: Card[]; // 3 cards
  group3: Card[]; // 3 cards
  group4: Card[]; // 4 cards
}

export interface InternalPlayerHand {
  dealtCards: Card[];
  arrangedGroups: HandGroups | null;
  isReady: boolean;
}

export interface TrickPlay {
  playerId: string;
  playerName: string;
  seatIndex: number;
  isAgent: boolean;
  cards: Card[];
  evaluation: EvaluationResult;
  points: number;
  playOrder: number;
}

export interface TrickResult {
  trickNumber: number; // 1, 2, 3, or 4
  plays: TrickPlay[];
  winnerPlayerId: string;
  winnerSeatIndex: number;
  winnerName: string;
  pointsAwarded: number;
  winningCards: Card[];
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  seatIndex: number;
  isAgent: boolean;
  connected: boolean;
  socketId?: string;
  cumulativeScore: number;
  roundScore: number;
  isReady: boolean; // Locked in "Up"
  hasPlayedCurrentTrick: boolean;
  disconnectedAt?: number | null;
  reconnectGraceExpiresAt?: number | null;
}

export type TableStatus =
  | 'WAITING'
  | 'DEALING'
  | 'ARRANGING'
  | 'PLAYING_TRICK'
  | 'TRICK_RESOLVED'
  | 'ROUND_SUMMARY'
  | 'GAME_OVER'
  | 'COMPLETED_CLOSED';

export interface PlayerRoundRecord {
  playerId: string;
  playerName: string;
  isAgent: boolean;
  seatIndex: number;
  roundScore: number;
  cumulativeScore: number;
  strategyUsed: string;
  features: number[]; // 10-feature normalized vector for this round
  cardsArranged?: HandGroups | null;
}

export interface DetailedRoundRecord {
  roundNumber: number;
  winnerSeat?: number;
  winnerName: string;
  pointsAwarded: number;
  winningHand?: string;
  playerScores: {
    playerName: string;
    roundScore: number;
    cumulativeScore: number;
  }[];
  playerDetails?: PlayerRoundRecord[];
  tricks?: TrickResult[];
  trainingSamples?: {
    features: number[];
    winningStrategy: string;
    score: number;
    playerId?: string;
    playerName?: string;
    roundNumber?: number;
  }[];
}

export interface TableState {
  tableId: string;
  tableName: string;
  status: TableStatus;
  players: Player[]; // exactly 4 elements for seats 0, 1, 2, 3
  dealerSeat: number;
  leadSeat: number;
  currentTurnSeat: number;
  currentRound: number;
  currentTrick: number; // 1 to 4
  currentTrickPlays: TrickPlay[];
  tricksHistory: TrickResult[];
  roundsHistory?: DetailedRoundRecord[];
  targetScore: number; // 1000
  gameWinnerSeat: number | null;
  seatWins?: number[]; // count of tournament game wins across table shuffles
  trainingSamples?: {
    features: number[];
    winningStrategy: string;
    score: number;
    playerId?: string;
    playerName?: string;
  }[];
  lastActionMessage: string;
  updatedAt: number;
}

// Client-specific state holding the local player's private hand:
export interface ClientLocalHand {
  dealtCards: Card[];
  arrangedGroups: HandGroups | null;
  isValidArrangement: boolean;
  isLockedIn: boolean;
}
