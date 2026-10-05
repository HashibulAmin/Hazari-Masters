import { Card, HandGroups, Player } from './types';
import { autoArrangeHand, ArrangementStrategy, ArrangementAnalysis } from './arranger';
import { offlineModel, ModelPrediction } from './mlModel';
import { extractFeatures } from './features';

export interface AgentPersona {
  name: string;
  avatar: string;
  title: string;
  strategy: ArrangementStrategy;
  reactionSpeedMs: number;
  playStyleDescription: string;
  usesModelInference: boolean;
}

export const AGENT_PERSONAS: AgentPersona[] = [
  {
    name: 'Agent Kabir',
    avatar: '🤖',
    title: 'Grandmaster Bot',
    strategy: 'optimal_ev',
    reactionSpeedMs: 750,
    playStyleDescription: 'Calculates exact Expected Points (EV), dumps low cards into losing tricks, and protects aces.',
    usesModelInference: true,
  },
  {
    name: 'Agent Tariq',
    avatar: '🎯',
    title: 'Sharpshooter Bot',
    strategy: 'aggressive',
    reactionSpeedMs: 850,
    playStyleDescription: 'Front-loads maximum firepower into Trick 1 & 2 to seize the lead and control the table tempo.',
    usesModelInference: false,
  },
  {
    name: 'Agent Ananya',
    avatar: '⚡',
    title: 'Tactical Bot',
    strategy: 'balanced',
    reactionSpeedMs: 700,
    playStyleDescription: 'Distributes card strength evenly to capture multiple tricks per round.',
    usesModelInference: false,
  },
  {
    name: 'Agent Maya',
    avatar: '🧠',
    title: 'Strategist Bot',
    strategy: 'defensive',
    reactionSpeedMs: 800,
    playStyleDescription: 'Defensive point-shield specialist. Hides 10-point cards in high combos and sets Round 4 traps.',
    usesModelInference: true,
  },
];

export function createAgentPlayer(seatIndex: number, overrideName?: string): Player {
  const persona = AGENT_PERSONAS[seatIndex % AGENT_PERSONAS.length];
  return {
    id: `agent_${seatIndex}_${Date.now()}`,
    name: overrideName || persona.name,
    avatar: persona.avatar,
    seatIndex,
    isAgent: true,
    connected: true,
    cumulativeScore: 0,
    roundScore: 0,
    isReady: false,
    hasPlayedCurrentTrick: false,
  };
}

/**
 * Computes the agent's partitioned groups automatically.
 * When usesModelInference is true (e.g. Kabir & Maya), it runs offline model inference
 * on the hand features to pick the highest-probability winning strategy!
 */
export function arrangeAgentHand(cards: Card[], seatIndex: number = 0): { groups: HandGroups; strategyUsed: ArrangementStrategy; modelPrediction?: ModelPrediction } {
  const persona = AGENT_PERSONAS[seatIndex % AGENT_PERSONAS.length];
  let chosenStrategy: ArrangementStrategy = persona.strategy;
  let prediction: ModelPrediction | undefined;

  if (persona.usesModelInference) {
    const features = extractFeatures(cards);
    prediction = offlineModel.predict(features.normalizedVector);
    // If model has high confidence (> 60%), adopt model's predicted strategy!
    if (prediction.confidence > 0.60) {
      chosenStrategy = prediction.strategy;
    }
  }

  const analysis = autoArrangeHand(cards, chosenStrategy);
  return {
    groups: analysis.groups,
    strategyUsed: chosenStrategy,
    modelPrediction: prediction,
  };
}

export function analyzeAgentHand(cards: Card[], seatIndex: number = 0): ArrangementAnalysis {
  const persona = AGENT_PERSONAS[seatIndex % AGENT_PERSONAS.length];
  return autoArrangeHand(cards, persona.strategy);
}
