import React from 'react';
import { TableState } from '../core/hazari/types';
import { Trophy, Bot, User, CheckCircle2, ArrowLeft, Award, RotateCcw } from 'lucide-react';

interface ScoreboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableState: TableState;
  userSeatIndex: number | null;
}

export const ScoreboardModal: React.FC<ScoreboardModalProps> = ({
  isOpen,
  onClose,
  tableState,
  userSeatIndex,
}) => {
  if (!isOpen) return null;

  const sortedPlayers = [...tableState.players].sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  const seatWins = tableState.seatWins || [0, 0, 0, 0];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Header with Back button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold"
              title="Back to Table"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Hazari Championship Board</span>
              </h2>
              <p className="text-[11px] text-slate-400">Target: 1000 points. Multi-round championship history.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Players Standings */}
        <div className="p-6 space-y-3 max-h-[65vh] overflow-y-auto">
          {sortedPlayers.map((player, rank) => {
            const isMe = userSeatIndex === player.seatIndex;
            const progress = Math.min(100, (player.cumulativeScore / 1000) * 100);
            const winsCount = seatWins[player.seatIndex] || 0;

            return (
              <div
                key={player.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  rank === 0
                    ? 'bg-amber-950/30 border-amber-500/40 shadow-lg'
                    : isMe
                    ? 'bg-emerald-950/30 border-emerald-500/40'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        rank === 0
                          ? 'bg-amber-500 text-slate-950'
                          : rank === 1
                          ? 'bg-slate-300 text-slate-950'
                          : rank === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {rank + 1}
                    </span>

                    <div className="text-xl">{player.avatar}</div>

                    <div>
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{player.name}</span>
                        {isMe && <span className="text-[10px] text-emerald-400 font-normal">(You)</span>}
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full border ${
                            player.isAgent
                              ? 'bg-sky-950 text-sky-400 border-sky-700'
                              : 'bg-emerald-950 text-emerald-400 border-emerald-700'
                          }`}
                        >
                          {player.isAgent ? 'Bot' : 'Human'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400">Seat {player.seatIndex + 1}</span>
                        {winsCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                            <Trophy className="w-2.5 h-2.5 text-amber-400" />
                            <span>{winsCount}x 1000-pt Champion</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-base font-black text-amber-300">
                      {player.cumulativeScore} <span className="text-[10px] text-amber-500 font-normal">/ 1000</span>
                    </div>
                    {player.roundScore > 0 && (
                      <span className="text-[10px] text-emerald-400 font-mono">+{player.roundScore} this round</span>
                    )}
                  </div>
                </div>

                {/* Highlighted Wins Count text for each 1000 point win on this table */}
                {winsCount > 0 && (
                  <div className="mt-2 py-1 px-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Wins count on this table:</span>
                    </div>
                    <span className="font-mono text-xs text-amber-200 font-black">
                      {winsCount} {winsCount === 1 ? 'Win' : 'Wins'} (1000-point Tournament Victories)
                    </span>
                  </div>
                )}

                {/* Progress bar */}
                <div className="mt-2.5 w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      rank === 0
                        ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300'
                        : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with Back button */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Shuffling table resets points and tracks tournament wins.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            Back to Table
          </button>
        </div>
      </div>
    </div>
  );
};
