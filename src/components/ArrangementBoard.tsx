import React, { useState, useEffect } from 'react';
import { Card, HandGroups } from '../core/hazari/types';
import {
  autoArrangeHand,
  validateArrangement,
  autoSortPlayerGroups,
  ArrangementStrategy,
  estimate3CardWinRate,
} from '../core/hazari/arranger';
import { evaluate3CardGroup, evaluateExtraGroup } from '../core/hazari/evaluator';
import { offlineModel, ModelPrediction } from '../core/hazari/mlModel';
import { PlayingCard } from './PlayingCard';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  ArrowUpCircle,
  Lock,
  Unlock,
  Shield,
  Zap,
  Scale,
  Award,
  Brain,
  Cpu,
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';

interface ArrangementBoardProps {
  cards: Card[];
  isLockedIn: boolean;
  onLockIn: (groups: HandGroups, strategy: ArrangementStrategy) => void;
  audioEnabled: boolean;
}

export const ArrangementBoard: React.FC<ArrangementBoardProps> = ({
  cards,
  isLockedIn,
  onLockIn,
  audioEnabled,
}) => {
  const [group1, setGroup1] = useState<Card[]>([]);
  const [group2, setGroup2] = useState<Card[]>([]);
  const [group3, setGroup3] = useState<Card[]>([]);
  const [group4, setGroup4] = useState<Card[]>([]);
  const [unassigned, setUnassigned] = useState<Card[]>([]);
  const [selectedCardCode, setSelectedCardCode] = useState<string | null>(null);
  const [activeStrategy, setActiveStrategy] = useState<ArrangementStrategy>('optimal_ev');
  const [aiSummary, setAiSummary] = useState<string>('');
  const [modelSuggestion, setModelSuggestion] = useState<ModelPrediction | null>(null);

  // Initialize and predict with offline ML model when cards arrive or activeStrategy changes
  useEffect(() => {
    if (cards && cards.length === 13) {
      try {
        // Run offline ML prediction on this specific hand
        const pred = offlineModel.predictForHand(cards);
        setModelSuggestion(pred);

        const analysis = autoArrangeHand(cards, activeStrategy);
        setGroup1(analysis.groups.group1);
        setGroup2(analysis.groups.group2);
        setGroup3(analysis.groups.group3);
        setGroup4(analysis.groups.group4);
        setAiSummary(analysis.summary);
        setUnassigned([]);
      } catch {
        setUnassigned([...cards]);
        setGroup1([]);
        setGroup2([]);
        setGroup3([]);
        setGroup4([]);
      }
    }
  }, [cards, activeStrategy]);

  const currentGroups: HandGroups = { group1, group2, group3, group4 };
  const validation = validateArrangement(currentGroups);

  const eval1 = group1.length === 3 ? evaluate3CardGroup(group1) : null;
  const eval2 = group2.length === 3 ? evaluate3CardGroup(group2) : null;
  const eval3 = group3.length === 3 ? evaluate3CardGroup(group3) : null;
  const eval4 = group4.length === 4 ? evaluateExtraGroup(group4) : null;

  // Win rate estimations
  const winRate1 = eval1 ? Math.round(estimate3CardWinRate(eval1) * 100) : 0;
  const winRate2 = eval2 ? Math.round(estimate3CardWinRate(eval2) * 100) : 0;
  const winRate3 = eval3 ? Math.round(estimate3CardWinRate(eval3) * 100) : 0;
  const winRate4 = eval4 ? (eval4.category >= 2 ? 50 : 18) : 0;

  const totalPoints = [...group1, ...group2, ...group3, ...group4].reduce((sum, c) => sum + c.points, 0);

  const handleApplyStrategy = (strat: ArrangementStrategy) => {
    if (isLockedIn) return;
    setActiveStrategy(strat);
    if (audioEnabled) sounds.playDealSound();
    const analysis = autoArrangeHand(cards, strat);
    setGroup1(analysis.groups.group1);
    setGroup2(analysis.groups.group2);
    setGroup3(analysis.groups.group3);
    setGroup4(analysis.groups.group4);
    setAiSummary(analysis.summary);
    setUnassigned([]);
    setSelectedCardCode(null);
  };

  const handleAutoSort = () => {
    if (isLockedIn) return;
    if (group1.length === 3 && group2.length === 3 && group3.length === 3) {
      if (audioEnabled) sounds.playCardPlaySound();
      const sorted = autoSortPlayerGroups(currentGroups);
      setGroup1(sorted.group1);
      setGroup2(sorted.group2);
      setGroup3(sorted.group3);
      setGroup4(sorted.group4);
    }
  };

  const handleCardClick = (card: Card, sourceGroup: 'unassigned' | 1 | 2 | 3 | 4) => {
    if (isLockedIn) return;

    if (!selectedCardCode) {
      setSelectedCardCode(card.code);
      if (audioEnabled) sounds.playCardPlaySound();
      return;
    }

    if (selectedCardCode === card.code) {
      setSelectedCardCode(null);
      return;
    }

    swapCards(selectedCardCode, card.code);
    setSelectedCardCode(null);
    if (audioEnabled) sounds.playCardPlaySound();
  };

  const handleSlotClick = (targetGroup: 1 | 2 | 3 | 4) => {
    if (isLockedIn || !selectedCardCode) return;
    moveCardToGroup(selectedCardCode, targetGroup);
    setSelectedCardCode(null);
    if (audioEnabled) sounds.playCardPlaySound();
  };

  const swapCards = (codeA: string, codeB: string) => {
    const allGroups = [
      { name: 'g1', list: [...group1], setter: setGroup1 },
      { name: 'g2', list: [...group2], setter: setGroup2 },
      { name: 'g3', list: [...group3], setter: setGroup3 },
      { name: 'g4', list: [...group4], setter: setGroup4 },
      { name: 'un', list: [...unassigned], setter: setUnassigned },
    ];

    let sourceObj: any = null;
    let targetObj: any = null;
    let cardA: Card | null = null;
    let cardB: Card | null = null;

    allGroups.forEach((g) => {
      const idxA = g.list.findIndex((c) => c.code === codeA);
      if (idxA !== -1) {
        sourceObj = { g, idx: idxA };
        cardA = g.list[idxA];
      }
      const idxB = g.list.findIndex((c) => c.code === codeB);
      if (idxB !== -1) {
        targetObj = { g, idx: idxB };
        cardB = g.list[idxB];
      }
    });

    if (sourceObj && targetObj && cardA && cardB) {
      sourceObj.g.list[sourceObj.idx] = cardB;
      targetObj.g.list[targetObj.idx] = cardA;
      sourceObj.g.setter(sourceObj.g.list);
      targetObj.g.setter(targetObj.g.list);
    }
  };

  const moveCardToGroup = (code: string, targetGroupNum: 1 | 2 | 3 | 4) => {
    const limits: Record<number, number> = { 1: 3, 2: 3, 3: 3, 4: 4 };
    const targetLimit = limits[targetGroupNum];

    const targetList = targetGroupNum === 1 ? group1 : targetGroupNum === 2 ? group2 : targetGroupNum === 3 ? group3 : group4;
    const targetSetter = targetGroupNum === 1 ? setGroup1 : targetGroupNum === 2 ? setGroup2 : targetGroupNum === 3 ? setGroup3 : setGroup4;

    if (targetList.length >= targetLimit) return;

    let movedCard: Card | null = null;
    const removeFrom = (list: Card[], setter: (val: Card[]) => void) => {
      const idx = list.findIndex((c) => c.code === code);
      if (idx !== -1) {
        movedCard = list[idx];
        setter(list.filter((_, i) => i !== idx));
      }
    };

    removeFrom(unassigned, setUnassigned);
    removeFrom(group1, setGroup1);
    removeFrom(group2, setGroup2);
    removeFrom(group3, setGroup3);
    removeFrom(group4, setGroup4);

    if (movedCard) {
      targetSetter([...targetList, movedCard]);
    }
  };

  const handleLockIn = () => {
    if (!validation.isValid) return;
    if (audioEnabled) sounds.playTrickWinSound();
    onLockIn(currentGroups, activeStrategy);
  };

  const getWinRateBadgeClass = (rate: number) => {
    if (rate >= 80) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (rate >= 50) return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    if (rate >= 25) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  };

  return (
    <div className="w-full bg-slate-900/95 backdrop-blur-md border border-emerald-500/30 rounded-3xl p-4 shadow-2xl text-slate-100 flex flex-col gap-4">
      {/* Top Header & Strategy Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 shadow-inner">
            13
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-100 flex items-center gap-2">
              Hazari Hand Partitioning
              {isLockedIn && (
                <span className="text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Locked (Up)
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-400">
              Rule: Group 1 ≥ Group 2 ≥ Group 3. Total Points: <span className="font-mono text-amber-300 font-bold">{totalPoints} pts</span>
            </p>
          </div>
        </div>

        {/* AI Strategy Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mr-1">AI Preset:</span>

          <button
            onClick={() => handleApplyStrategy('optimal_ev')}
            disabled={isLockedIn}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
              activeStrategy === 'optimal_ev'
                ? 'bg-amber-500 text-slate-950 scale-105 ring-2 ring-amber-400/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Championship: Optimizes Expected Value & point dumping"
          >
            <Award className="w-3.5 h-3.5" />
            <span>EV Grandmaster</span>
          </button>

          <button
            onClick={() => handleApplyStrategy('aggressive')}
            disabled={isLockedIn}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
              activeStrategy === 'aggressive'
                ? 'bg-rose-500 text-white scale-105 ring-2 ring-rose-400/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Aggressive: Breaks low trios/pairs to chase Straight Flushes and seize Trick 1"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Aggressive Lead</span>
          </button>

          <button
            onClick={() => handleApplyStrategy('defensive')}
            disabled={isLockedIn}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
              activeStrategy === 'defensive'
                ? 'bg-emerald-500 text-slate-950 scale-105 ring-2 ring-emerald-400/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Defensive: Preserves pairs and shields 10-point cards from loss"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Point Shield</span>
          </button>

          <button
            onClick={() => handleApplyStrategy('balanced')}
            disabled={isLockedIn}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
              activeStrategy === 'balanced'
                ? 'bg-sky-500 text-slate-950 scale-105 ring-2 ring-sky-400/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Balanced: Multi-trick threat distribution"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Balanced</span>
          </button>

          <button
            onClick={handleAutoSort}
            disabled={isLockedIn || !(group1.length === 3 && group2.length === 3 && group3.length === 3)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-slate-200 border border-slate-700 transition"
            title="Sort groups descending to satisfy legal ordering"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Legal Sort</span>
          </button>

          <button
            onClick={handleLockIn}
            disabled={!validation.isValid || isLockedIn}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all ml-1 ${
              validation.isValid && !isLockedIn
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 scale-105 animate-pulse'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            {isLockedIn ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <ArrowUpCircle className="w-4 h-4 text-slate-950" />}
            <span>{isLockedIn ? 'Locked In' : 'Declare UP'}</span>
          </button>
        </div>
      </div>

      {/* AI Model Intelligence Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-950/80 border border-purple-500/25 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-slate-300 font-medium">{aiSummary}</span>
        </div>

        {modelSuggestion && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-purple-300 flex items-center gap-1 bg-purple-950/60 border border-purple-500/40 px-2 py-0.5 rounded-full font-mono">
              <Brain className="w-3 h-3 text-purple-400" />
              <span>Offline Model Suggests:</span>
              <strong className="text-amber-300 uppercase font-bold">{modelSuggestion.strategy.replace('_', ' ')}</strong>
              <span>({Math.round(modelSuggestion.confidence * 100)}%)</span>
            </span>

            {activeStrategy !== modelSuggestion.strategy && (
              <button
                onClick={() => handleApplyStrategy(modelSuggestion.strategy)}
                disabled={isLockedIn}
                className="text-[10px] bg-purple-600 hover:bg-purple-500 px-2 py-0.5 rounded font-bold text-white transition shadow"
              >
                Apply
              </button>
            )}
          </div>
        )}
      </div>

      {/* Validation Warning */}
      {!validation.isValid && validation.error && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-950/70 border border-amber-600/40 text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{validation.error}</span>
        </div>
      )}

      {/* 4 Partition Slots with Win Probabilities */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Group 1 (3 Cards) */}
        <div
          onClick={() => handleSlotClick(1)}
          className={`relative rounded-2xl p-3 border transition-all ${
            eval1 ? 'bg-slate-950/70 border-emerald-500/40 shadow-lg' : 'bg-slate-950/30 border-dashed border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Group 1 (Trick 1)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getWinRateBadgeClass(winRate1)}`}>
              {winRate1}% Win Est
            </span>
          </div>

          <div className="min-h-[92px] flex items-center justify-center gap-2 flex-wrap bg-slate-900/50 rounded-xl p-2 border border-slate-800/80">
            {group1.map((card) => (
              <PlayingCard
                key={card.code}
                card={card}
                isSelected={selectedCardCode === card.code}
                onClick={() => handleCardClick(card, 1)}
                size="md"
              />
            ))}
            {group1.length === 0 && <span className="text-xs text-slate-500 italic">Tap cards to assign</span>}
          </div>

          {eval1 && (
            <div className="mt-2 text-[11px] flex items-center justify-between font-mono bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
              <span className="text-emerald-300 font-semibold">{eval1.label}</span>
              <span className="text-amber-400 font-bold">{eval1.points} pts</span>
            </div>
          )}
        </div>

        {/* Group 2 (3 Cards) */}
        <div
          onClick={() => handleSlotClick(2)}
          className={`relative rounded-2xl p-3 border transition-all ${
            eval2 ? 'bg-slate-950/70 border-sky-500/40 shadow-lg' : 'bg-slate-950/30 border-dashed border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Group 2 (Trick 2)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getWinRateBadgeClass(winRate2)}`}>
              {winRate2}% Win Est
            </span>
          </div>

          <div className="min-h-[92px] flex items-center justify-center gap-2 flex-wrap bg-slate-900/50 rounded-xl p-2 border border-slate-800/80">
            {group2.map((card) => (
              <PlayingCard
                key={card.code}
                card={card}
                isSelected={selectedCardCode === card.code}
                onClick={() => handleCardClick(card, 2)}
                size="md"
              />
            ))}
            {group2.length === 0 && <span className="text-xs text-slate-500 italic">Tap cards to assign</span>}
          </div>

          {eval2 && (
            <div className="mt-2 text-[11px] flex items-center justify-between font-mono bg-sky-950/40 border border-sky-800/40 px-2.5 py-1 rounded-lg">
              <span className="text-sky-300 font-semibold">{eval2.label}</span>
              <span className="text-amber-400 font-bold">{eval2.points} pts</span>
            </div>
          )}
        </div>

        {/* Group 3 (3 Cards) */}
        <div
          onClick={() => handleSlotClick(3)}
          className={`relative rounded-2xl p-3 border transition-all ${
            eval3 ? 'bg-slate-950/70 border-purple-500/40 shadow-lg' : 'bg-slate-950/30 border-dashed border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Group 3 (Trick 3)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getWinRateBadgeClass(winRate3)}`}>
              {winRate3}% Win Est
            </span>
          </div>

          <div className="min-h-[92px] flex items-center justify-center gap-2 flex-wrap bg-slate-900/50 rounded-xl p-2 border border-slate-800/80">
            {group3.map((card) => (
              <PlayingCard
                key={card.code}
                card={card}
                isSelected={selectedCardCode === card.code}
                onClick={() => handleCardClick(card, 3)}
                size="md"
              />
            ))}
            {group3.length === 0 && <span className="text-xs text-slate-500 italic">Tap cards to assign</span>}
          </div>

          {eval3 && (
            <div className="mt-2 text-[11px] flex items-center justify-between font-mono bg-purple-950/40 border border-purple-800/40 px-2.5 py-1 rounded-lg">
              <span className="text-purple-300 font-semibold">{eval3.label}</span>
              <span className="text-amber-400 font-bold">{eval3.points} pts</span>
            </div>
          )}
        </div>

        {/* Group 4 (4 Cards) */}
        <div
          onClick={() => handleSlotClick(4)}
          className={`relative rounded-2xl p-3 border transition-all ${
            eval4 ? 'bg-slate-950/70 border-amber-500/40 shadow-lg' : 'bg-slate-950/30 border-dashed border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Group 4 (Trick 4)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getWinRateBadgeClass(winRate4)}`}>
              {winRate4}% Win Est
            </span>
          </div>

          <div className="min-h-[92px] flex items-center justify-center gap-1.5 flex-wrap bg-slate-900/50 rounded-xl p-2 border border-slate-800/80">
            {group4.map((card) => (
              <PlayingCard
                key={card.code}
                card={card}
                isSelected={selectedCardCode === card.code}
                onClick={() => handleCardClick(card, 4)}
                size="md"
              />
            ))}
            {group4.length === 0 && <span className="text-xs text-slate-500 italic">Tap cards to assign</span>}
          </div>

          {eval4 && (
            <div className="mt-2 text-[11px] flex items-center justify-between font-mono bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-lg">
              <span className="text-amber-300 font-semibold">{eval4.label}</span>
              <span className="text-amber-400 font-bold">{eval4.points} pts</span>
            </div>
          )}
        </div>
      </div>

      {/* Unassigned Cards Tray (if any) */}
      {unassigned.length > 0 && (
        <div className="rounded-2xl p-3 bg-slate-950/80 border border-slate-800">
          <div className="text-xs font-bold text-slate-400 mb-2">Unassigned Cards ({unassigned.length}):</div>
          <div className="flex items-center gap-2 flex-wrap">
            {unassigned.map((card) => (
              <PlayingCard
                key={card.code}
                card={card}
                isSelected={selectedCardCode === card.code}
                onClick={() => handleCardClick(card, 'unassigned')}
                size="md"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
