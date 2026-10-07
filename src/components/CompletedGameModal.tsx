import React, { useState } from 'react';
import { CompletedGameRecord, trainUserModelOnSingleGame } from '../firebase/tableService';
import { UserProfile } from '../firebase/authService';
import { Trophy, ArrowLeft, Calendar, Award, Cpu, Sparkles, CheckCircle2, RefreshCw, Film } from 'lucide-react';

interface CompletedGameModalProps {
  game: CompletedGameRecord | null;
  onClose: () => void;
  currentUser?: UserProfile | null;
  onWatchReplay?: (game: CompletedGameRecord) => void;
}

export const CompletedGameModal: React.FC<CompletedGameModalProps> = ({
  game,
  onClose,
  currentUser,
  onWatchReplay,
}) => {
  const [isTraining, setIsTraining] = useState(false);
  const [trainStatus, setTrainStatus] = useState<string | null>(null);

  if (!game) return null;

  const dateStr = new Date(game.completedAt).toLocaleString();

  const handleTrainOnThisGame = async () => {
    if (!currentUser) return;
    setIsTraining(true);
    setTrainStatus(null);
    try {
      const res = await trainUserModelOnSingleGame(game, currentUser.uid, currentUser.username);
      setTrainStatus(
        `Local model successfully trained on this game! Accuracy: ${(res.accuracy * 100).toFixed(1)}% (${res.sampleCount} samples). Saved to your offline model.`
      );
    } catch (err: any) {
      setTrainStatus(`Training error: ${err.message}`);
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>{game.tableName} — Results Archive</span>
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{dateStr}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Winner Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-950 to-emerald-950/60 border border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl shadow-inner">
                👑
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Tournament Champion
                </span>
                <h3 className="text-base font-black text-slate-100">{game.winnerName}</h3>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Winning Score</span>
              <div className="font-mono text-xl font-black text-amber-300">
                {game.winnerCumulativeScore} pts
              </div>
            </div>
          </div>

          {/* Cumulative Score Summary Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Final Player Standings
            </h4>
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Rank</th>
                    <th className="py-2.5 px-4">Player</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4 text-right">Final Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {game.players
                    .slice()
                    .sort((a, b) => b.cumulativeScore - a.cumulativeScore)
                    .map((p, idx) => (
                      <tr key={p.id} className={idx === 0 ? 'bg-amber-950/20' : ''}>
                        <td className="py-2 px-4 font-bold text-slate-400">#{idx + 1}</td>
                        <td className="py-2 px-4 font-bold text-slate-200">
                          {p.name} {idx === 0 && '🏆'}
                        </td>
                        <td className="py-2 px-4">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                              p.isAgent
                                ? 'bg-sky-950 text-sky-400 border-sky-800'
                                : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            }`}
                          >
                            {p.isAgent ? 'Bot' : 'Human'}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-amber-300">
                          {p.cumulativeScore} pts
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Round-by-Round Breakdown Table */}
          {game.roundsHistory && game.roundsHistory.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Rounds History &amp; Points Log
              </h4>
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Round</th>
                      <th className="py-2.5 px-4">Round Winner</th>
                      <th className="py-2.5 px-4">Points Won</th>
                      <th className="py-2.5 px-4 text-right">Player Scores (Round / Total)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {game.roundsHistory.map((rh, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-4 font-bold text-slate-300">Round {rh.roundNumber}</td>
                        <td className="py-2.5 px-4 font-semibold text-emerald-400">{rh.winnerName}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-amber-400">+{rh.pointsAwarded} pts</td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            {rh.playerScores.map((ps, idx) => (
                              <span key={idx} className="text-slate-300">
                                {ps.playerName}: <strong className="text-amber-300 font-mono">+{ps.roundScore}</strong> ({ps.cumulativeScore} total)
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
            {onWatchReplay && (
              <button
                onClick={() => onWatchReplay(game)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition"
                title="Watch sequence of card plays and analyze strategies"
              >
                <Film className="w-3.5 h-3.5 text-purple-200" />
                <span>Watch Match Replay</span>
              </button>
            )}

            {currentUser && (
              <>
                <button
                  onClick={handleTrainOnThisGame}
                  disabled={isTraining}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg transition"
                  title="Train your offline personal AI model on this match session"
                >
                  {isTraining ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Cpu className="w-3.5 h-3.5 text-emerald-200" />
                  )}
                  <span>{isTraining ? 'Training Local Model...' : 'Train My Local AI on this Game'}</span>
                </button>
                {trainStatus && (
                  <span className="text-[11px] text-emerald-400 font-medium">
                    {trainStatus}
                  </span>
                )}
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition ml-auto"
          >
            Close Archive
          </button>
        </div>
      </div>
    </div>
  );
};
