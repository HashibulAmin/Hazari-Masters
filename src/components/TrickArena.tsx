import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TableState, TrickPlay } from '../core/hazari/types';
import { PlayingCard } from './PlayingCard';
import { Trophy, Flame, Play, Sparkles } from 'lucide-react';

interface TrickArenaProps {
  tableState: TableState;
  onStartDeal?: () => void;
  canStartDeal?: boolean;
}

export const TrickArena: React.FC<TrickArenaProps> = ({
  tableState,
  onStartDeal,
  canStartDeal,
}) => {
  const { status, currentTrick, currentTrickPlays, tricksHistory, lastActionMessage } = tableState;
  const lastTrickResult = tricksHistory[tricksHistory.length - 1];

  const totalPotPoints = currentTrickPlays.reduce((sum, p) => sum + p.points, 0);

  return (
    <div className="relative w-full max-w-5xl h-[275px] sm:h-[305px] rounded-[44px] bg-gradient-to-b from-emerald-900 via-emerald-950 to-slate-950 border-[6px] border-amber-950/80 ring-1 ring-amber-500/20 shadow-[inset_0_0_90px_rgba(0,0,0,0.85),0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center justify-between p-3.5 sm:p-4 overflow-hidden">
      {/* Felt subtle texture and oval ring */}
      <div className="absolute inset-2 rounded-[38px] border border-emerald-500/20 pointer-events-none" />
      <div className="absolute inset-5 rounded-[32px] border border-dashed border-emerald-400/10 pointer-events-none" />

      {/* Top Trick Info Header */}
      <div className="relative z-10 flex items-center justify-between w-full px-4 text-xs font-semibold">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-slate-900/80 border border-emerald-500/30 text-emerald-300 font-mono">
            Round {tableState.currentRound}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-900/80 border border-amber-500/30 text-amber-300 font-mono">
            Trick {currentTrick}/4
          </span>
        </div>

        {totalPotPoints > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold font-mono animate-pulse">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Pot: {totalPotPoints} pts</span>
          </div>
        )}
      </div>

      {/* Center Plays Display */}
      <div className="relative z-10 flex-1 w-full flex items-center justify-center">
        {status === 'WAITING' ? (
          <div className="flex flex-col items-center text-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-2xl shadow-xl">
              🎴
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">Hazari Championship Table</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 max-w-sm mt-0.5">
                4 players, 13 cards each. First player to reach 1000 cumulative points wins the tournament.
              </p>
            </div>
            {canStartDeal && onStartDeal && (
              <button
                onClick={onStartDeal}
                className="mt-1 flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Start Deal</span>
              </button>
            )}
          </div>
        ) : status === 'DEALING' ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-2.5"
          >
            <div className="relative w-14 h-20">
              <div className="absolute inset-0 rounded-lg bg-indigo-900 border border-indigo-400/50 shadow-xl rotate-6 animate-pulse" />
              <div className="absolute inset-0 rounded-lg bg-indigo-950 border border-indigo-300/40 shadow-xl -rotate-6 animate-pulse" />
              <div className="absolute inset-0 rounded-lg bg-indigo-900 border border-indigo-400/60 shadow-2xl flex items-center justify-center text-amber-300 font-serif font-black text-sm">
                1000
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-300 animate-pulse">
              Dealing 13 cards to 4 players...
            </span>
          </motion.div>
        ) : status === 'ARRANGING' ? (
          <div className="flex flex-col items-center text-center gap-1.5 max-w-md">
            <span className="text-2xl animate-bounce">🃏</span>
            <span className="text-sm font-bold text-slate-200">Players are arranging hands</span>
            <p className="text-xs text-slate-400">
              Configure your 3, 3, 3, and 4 cards below and declare UP to begin Trick 1!
            </p>
          </div>
        ) : (
          /* Active Trick Plays Grid (Expansive 4-player display across wide table) */
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 w-full max-w-4xl px-2">
            <AnimatePresence>
              {currentTrickPlays.map((play: TrickPlay, idx) => (
                <motion.div
                  key={`${play.playerId}-${idx}`}
                  initial={{ scale: 0.5, y: -20, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="flex flex-col items-center justify-between p-2 rounded-2xl bg-slate-950/85 border border-slate-800 backdrop-blur-md shadow-xl min-h-[120px]"
                >
                  <div className="flex items-center justify-between w-full text-[10px] text-slate-400 mb-1 px-1">
                    <span className="font-semibold text-slate-200 truncate">{play.playerName}</span>
                    <span className="font-mono text-amber-400 font-bold">+{play.points}p</span>
                  </div>

                  {/* Played Cards Fan */}
                  <div className="flex items-center -space-x-3.5 my-1.5 py-0.5">
                    {play.cards.map((card) => (
                      <PlayingCard key={card.code} card={card} size="sm" showPoints={false} />
                    ))}
                  </div>

                  {/* Evaluation Label */}
                  <span className="text-[10px] font-semibold text-emerald-400 truncate max-w-[130px] text-center px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30">
                    {play.evaluation.categoryName}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Bottom Action / Resolution Banner */}
      <div className="relative z-10 w-full text-center">
        {status === 'TRICK_RESOLVED' && lastTrickResult ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 border border-amber-400/50 shadow-lg text-xs font-bold text-amber-300"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>
              {lastTrickResult.winnerName} takes Trick {lastTrickResult.trickNumber} (+{lastTrickResult.pointsAwarded} pts)
            </span>
          </motion.div>
        ) : (
          <div className="text-[11px] text-slate-400 bg-slate-950/60 backdrop-blur-sm px-3 py-1 rounded-full inline-block border border-slate-800">
            {lastActionMessage}
          </div>
        )}
      </div>
    </div>
  );
};
