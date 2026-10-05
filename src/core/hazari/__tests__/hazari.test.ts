import { createDeck, shuffleAndDeal, hasRun, countPairs, createCard } from '../deck';
import { evaluate3CardGroup, evaluateExtraGroup, compareGroupEvaluations } from '../evaluator';
import { autoArrangeHand, validateArrangement, findOptimalArrangement } from '../arranger';
import { resolveTrick, checkGameWinner } from '../rules';
import { CombinationRank, TrickPlay } from '../types';
import { extractFeatures } from '../features';
import { offlineModel } from '../mlModel';

export function runHazariCoreTests(): { passed: boolean; results: { name: string; success: boolean; details?: string }[] } {
  const results: { name: string; success: boolean; details?: string }[] = [];

  const assert = (name: string, condition: boolean, details?: string) => {
    results.push({ name, success: Boolean(condition), details });
  };

  try {
    // 1. Deck integrity
    const deck = createDeck();
    assert('Deck contains 52 unique cards', deck.length === 52 && new Set(deck.map((c) => c.code)).size === 52);

    const totalPoints = deck.reduce((acc, c) => acc + c.points, 0);
    assert('Total points in deck is exactly 360', totalPoints === 360, `Got ${totalPoints}`);

    // 2. Evaluator ranking
    const troy = evaluate3CardGroup([createCard('A', '♠'), createCard('A', '♥'), createCard('A', '♦')]);
    assert('Trio evaluation category is TROY (6)', troy.category === CombinationRank.TROY);

    const colourRun = evaluate3CardGroup([createCard('Q', '♠'), createCard('K', '♠'), createCard('A', '♠')]);
    assert('Colour Run category is COLOUR_RUN (5)', colourRun.category === CombinationRank.COLOUR_RUN);

    const run = evaluate3CardGroup([createCard('Q', '♠'), createCard('K', '♥'), createCard('A', '♦')]);
    assert('Run category is RUN (4)', run.category === CombinationRank.RUN);

    const colour = evaluate3CardGroup([createCard('2', '♠'), createCard('7', '♠'), createCard('A', '♠')]);
    assert('Colour category is COLOUR (3)', colour.category === CombinationRank.COLOUR);

    const pair = evaluate3CardGroup([createCard('9', '♠'), createCard('9', '♦'), createCard('2', '♣')]);
    assert('Pair category is PAIR (2)', pair.category === CombinationRank.PAIR);

    const indi = evaluate3CardGroup([createCard('2', '♠'), createCard('5', '♦'), createCard('9', '♣')]);
    assert('Indi category is INDI (1)', indi.category === CombinationRank.INDI);

    assert('TROY beats COLOUR_RUN', compareGroupEvaluations(troy, colourRun) > 0);
    assert('COLOUR_RUN beats RUN', compareGroupEvaluations(colourRun, run) > 0);
    assert('RUN beats COLOUR', compareGroupEvaluations(run, colour) > 0);
    assert('COLOUR beats PAIR', compareGroupEvaluations(colour, pair) > 0);
    assert('PAIR beats INDI', compareGroupEvaluations(pair, indi) > 0);

    // 3. Special A-2-3 run
    const lowAceRun = evaluate3CardGroup([createCard('A', '♠'), createCard('2', '♥'), createCard('3', '♦')]);
    assert('A-2-3 is recognized as a valid RUN', lowAceRun.category === CombinationRank.RUN);

    // 4. Updated 4-card extra group evaluation (best 3-card subset + kicker)
    const extraGroupQuad = evaluateExtraGroup([createCard('10', '♠'), createCard('J', '♠'), createCard('Q', '♠'), createCard('2', '♦')]);
    assert('Extra 4-card group detects Straight Flush subset', extraGroupQuad.category === CombinationRank.COLOUR_RUN);

    // 5. Tie breaker: later play wins ties
    const play1: TrickPlay = {
      playerId: 'p1',
      playerName: 'Player 1',
      seatIndex: 0,
      isAgent: false,
      cards: [createCard('K', '♠'), createCard('K', '♥'), createCard('2', '♦')],
      evaluation: evaluate3CardGroup([createCard('K', '♠'), createCard('K', '♥'), createCard('2', '♦')]),
      points: 25,
      playOrder: 0,
    };
    const play2: TrickPlay = {
      playerId: 'p2',
      playerName: 'Player 2',
      seatIndex: 1,
      isAgent: true,
      cards: [createCard('K', '♦'), createCard('K', '♣'), createCard('2', '♠')],
      evaluation: evaluate3CardGroup([createCard('K', '♦'), createCard('K', '♣'), createCard('2', '♠')]),
      points: 25,
      playOrder: 1,
    };
    const trickRes = resolveTrick(1, [play1, play2]);
    assert('Later played group wins tie in Hazari', trickRes.winnerPlayerId === 'p2', `Winner was ${trickRes.winnerPlayerId}`);

    // 6. Deal validation
    const dealtHands = shuffleAndDeal();
    assert('Deal distributes 4 hands of 13 cards', dealtHands.length === 4 && dealtHands.every((h) => h.length === 13));
    assert('Dealt hands satisfy Hazari run & pair requirements', dealtHands.every((h) => hasRun(h) && countPairs(h) <= 6));

    // 7. Multi-strategy Auto-Arrange & 10-Feature Extractor
    const sampleHand = dealtHands[0];
    const features = extractFeatures(sampleHand);
    assert('10-feature vector extracted accurately', features.normalizedVector.length === 10);

    const modelPred = offlineModel.predictForHand(sampleHand);
    assert('Offline model outputs strategy prediction & confidence', Boolean(modelPred.strategy && modelPred.confidence >= 0));

    const arrEV = autoArrangeHand(sampleHand, 'optimal_ev');
    const arrAgg = autoArrangeHand(sampleHand, 'aggressive');
    const arrDef = autoArrangeHand(sampleHand, 'defensive');
    const arrBal = autoArrangeHand(sampleHand, 'balanced');

    assert('EV arrangement satisfies Hazari G1 >= G2 >= G3', validateArrangement(arrEV.groups).isValid);
    assert('Aggressive arrangement satisfies Hazari G1 >= G2 >= G3', validateArrangement(arrAgg.groups).isValid);
    assert('Defensive arrangement satisfies Hazari G1 >= G2 >= G3', validateArrangement(arrDef.groups).isValid);
    assert('Balanced arrangement satisfies Hazari G1 >= G2 >= G3', validateArrangement(arrBal.groups).isValid);

    // 8. 1000 points win condition
    const midGame = checkGameWinner([360, 420, 290, 810]);
    assert('Midgame with < 1000 points does not end game', !midGame.isGameOver);

    const wonGame = checkGameWinner([1020, 950, 400, 890]);
    assert('Reaching 1000 points triggers game over with highest scorer', wonGame.isGameOver && wonGame.winnerSeatIndex === 0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name: 'Exception during core test execution', success: false, details: message });
  }

  const passed = results.every((r) => r.success);
  return { passed, results };
}
