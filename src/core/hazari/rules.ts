import { Card, EvaluationResult, TrickPlay, TrickResult } from './types';
import { compareTuples } from './evaluator';

/**
 * Resolves a trick given the 4 plays in play order.
 * Rule from gist:
 * "Iterate in play order; if a played group's evaluation is equal to or higher than the current best,
 * then that player becomes the current winner (so later plays win ties)."
 */
export function resolveTrick(trickNumber: number, plays: TrickPlay[]): TrickResult {
  if (plays.length === 0) {
    throw new Error('Cannot resolve an empty trick');
  }

  let bestPlay = plays[0];

  for (let i = 1; i < plays.length; i++) {
    const play = plays[i];
    const comparison = compareTuples(play.evaluation.comparisonTuple, bestPlay.evaluation.comparisonTuple);
    // If higher or equal (later play wins tie):
    if (comparison >= 0) {
      bestPlay = play;
    }
  }

  const allCards: Card[] = [];
  let totalPoints = 0;
  for (const p of plays) {
    for (const card of p.cards) {
      allCards.push(card);
    }
    totalPoints += p.points;
  }

  return {
    trickNumber,
    plays,
    winnerPlayerId: bestPlay.playerId,
    winnerSeatIndex: bestPlay.seatIndex,
    winnerName: bestPlay.playerName,
    pointsAwarded: totalPoints,
    winningCards: allCards,
  };
}

export function checkGameWinner(cumulativeScores: number[], targetScore = 1000): { isGameOver: boolean; winnerSeatIndex: number | null } {
  let highestScore = -1;
  let winnerSeat: number | null = null;
  let reachedTarget = false;

  for (let seat = 0; seat < cumulativeScores.length; seat++) {
    const score = cumulativeScores[seat];
    if (score >= targetScore) {
      reachedTarget = true;
    }
    if (score > highestScore) {
      highestScore = score;
      winnerSeat = seat;
    }
  }

  return {
    isGameOver: reachedTarget,
    winnerSeatIndex: reachedTarget ? winnerSeat : null,
  };
}
