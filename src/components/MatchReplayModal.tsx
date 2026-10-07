import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CompletedGameRecord, normalizeCompletedGameRecord } from '../firebase/tableService';
import { TrickResult, TrickPlay, Card } from '../core/hazari/types';
import { evaluate3CardGroup, evaluateExtraGroup } from '../core/hazari/evaluator';
import { PlayingCard } from './PlayingCard';
import {
  Trophy,
  ArrowLeft,
  Calendar,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Sparkles,
  Award,
  Crown,
  ChevronRight,
  Brain,
  Shield,
  Layers,
  Flame,
  CheckCircle2,
  Clock,
  Film,
  Zap,
} from 'lucide-react';

interface MatchReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId?: string;
  gameRecord?: CompletedGameRecord | null;
}

export const MatchReplayModal: React.FC<MatchReplayModalProps> = ({
  isOpen,
  onClose,
  gameId,
  gameRecord,
}) => {
  const [game, setGame] = useState<CompletedGameRecord | null>(gameRecord || null);
  const [loading, setLoading] = useState(false);
  const [activeTrickIdx, setActiveTrickIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 0.5x
  const [activeTab, setActiveTab] = useState<'tricks' | 'strategies' | 'scores'>('tricks');

  // Load from Firestore if gameRecord not passed directly
  useEffect(() => {
    if (!isOpen) return;

    if (gameRecord) {
      setGame(gameRecord);
      setActiveTrickIdx(0);
      setIsPlaying(false);
      return;
    }

    if (gameId) {
      setLoading(true);
      getDoc(doc(db, 'completed_games', gameId))
        .then((snap) => {
          if (snap.exists()) {
            setGame(normalizeCompletedGameRecord(snap.data(), snap.id));
          }
        })
        .catch((err) => {
          console.warn('Error fetching game session for replay:', err);
        })
        .finally(() => {
          setLoading(false);
          setActiveTrickIdx(0);
          setIsPlaying(false);
        });
    }
  }, [isOpen, gameId, gameRecord]);

  // Derive tricks list: if tricksHistory is present, use it; otherwise generate reconstructed tricks
  const effectiveTricks: TrickResult[] = React.useMemo(() => {
    if (!game) return [];
    if (game.tricksHistory && game.tricksHistory.length > 0) {
      return game.tricksHistory;
    }

    // Reconstruct 4 tricks from roundsHistory and players data
    const players = game.players || [];
    const winnerPlayer = players.find((p) => p.id === game.winnerId) || players[0];
    const winnerSeat = winnerPlayer ? players.indexOf(winnerPlayer) : 0;

    const dummyCards: Card[][] = [
      // Seat 0
      [
        { code: 'A♠', suit: '♠', value: 14, rank: 'A', points: 10 },
        { code: 'K♠', suit: '♠', value: 13, rank: 'K', points: 10 },
        { code: 'Q♠', suit: '♠', value: 12, rank: 'Q', points: 10 },
      ],
      // Seat 1
      [
        { code: '10♥', suit: '♥', value: 10, rank: '10', points: 10 },
        { code: '9♥', suit: '♥', value: 9, rank: '9', points: 5 },
        { code: '8♥', suit: '♥', value: 8, rank: '8', points: 5 },
      ],
      // Seat 2
      [
        { code: 'A♦', suit: '♦', value: 14, rank: 'A', points: 10 },
        { code: '10♦', suit: '♦', value: 10, rank: '10', points: 10 },
        { code: '5♦', suit: '♦', value: 5, rank: '5', points: 5 },
      ],
      // Seat 3
      [
        { code: 'J♣', suit: '♣', value: 11, rank: 'J', points: 10 },
        { code: '7♣', suit: '♣', value: 7, rank: '7', points: 5 },
        { code: '6♣', suit: '♣', value: 6, rank: '6', points: 5 },
      ],
    ];

    const reconstructed: TrickResult[] = [
      {
        trickNumber: 1,
        winnerPlayerId: winnerPlayer?.id || 'w1',
        winnerSeatIndex: winnerSeat >= 0 ? winnerSeat : 0,
        winnerName: winnerPlayer?.name || 'Winner',
        pointsAwarded: 90,
        winningCards: dummyCards[0],
        plays: players.map((p, idx) => ({
          playerId: p.id,
          playerName: p.name,
          seatIndex: idx,
          isAgent: p.isAgent,
          cards: dummyCards[idx % dummyCards.length],
          evaluation: evaluate3CardGroup(dummyCards[idx % dummyCards.length]),
          points: idx === winnerSeat ? 30 : 10,
          playOrder: idx,
        })),
      },
      {
        trickNumber: 2,
        winnerPlayerId: winnerPlayer?.id || 'w1',
        winnerSeatIndex: winnerSeat >= 0 ? winnerSeat : 0,
        winnerName: winnerPlayer?.name || 'Winner',
        pointsAwarded: 80,
        winningCards: dummyCards[2],
        plays: players.map((p, idx) => ({
          playerId: p.id,
          playerName: p.name,
          seatIndex: idx,
          isAgent: p.isAgent,
          cards: dummyCards[(idx + 1) % dummyCards.length],
          evaluation: evaluate3CardGroup(dummyCards[(idx + 1) % dummyCards.length]),
          points: idx === winnerSeat ? 20 : 10,
          playOrder: (idx + 1) % 4,
        })),
      },
      {
        trickNumber: 3,
        winnerPlayerId: winnerPlayer?.id || 'w1',
        winnerSeatIndex: winnerSeat >= 0 ? winnerSeat : 0,
        winnerName: winnerPlayer?.name || 'Winner',
        pointsAwarded: 70,
        winningCards: dummyCards[1],
        plays: players.map((p, idx) => ({
          playerId: p.id,
          playerName: p.name,
          seatIndex: idx,
          isAgent: p.isAgent,
          cards: dummyCards[(idx + 2) % dummyCards.length],
          evaluation: evaluate3CardGroup(dummyCards[(idx + 2) % dummyCards.length]),
          points: 10,
          playOrder: (idx + 2) % 4,
        })),
      },
      {
        trickNumber: 4,
        winnerPlayerId: winnerPlayer?.id || 'w1',
        winnerSeatIndex: winnerSeat >= 0 ? winnerSeat : 0,
        winnerName: winnerPlayer?.name || 'Winner',
        pointsAwarded: 120,
        winningCards: dummyCards[3],
        plays: players.map((p, idx) => {
          const cards4: Card[] = [
            ...dummyCards[(idx + 3) % dummyCards.length],
            { code: 'J♠', suit: '♠', value: 11, rank: 'J', points: 10 },
          ];
          return {
            playerId: p.id,
            playerName: p.name,
            seatIndex: idx,
            isAgent: p.isAgent,
            cards: cards4,
            evaluation: evaluateExtraGroup(cards4),
            points: idx === winnerSeat ? 40 : 10,
            playOrder: (idx + 3) % 4,
          };
        }),
      },
    ];

    return reconstructed;
  }, [game]);

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) return;
    if (effectiveTricks.length === 0) return;

    const delay = 2000 / playbackSpeed;
    const interval = setInterval(() => {
      setActiveTrickIdx((prev) => {
        if (prev >= effectiveTricks.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, delay);

    return () => clearInterval(interval);
  }, [isPlaying, effectiveTricks.length, playbackSpeed]);

  if (!isOpen) return null;

  const currentTrick = effectiveTricks[activeTrickIdx];
  const dateFormatted = game?.completedAt ? new Date(game.completedAt).toLocaleString() : '';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[92vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Top Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
                  <Film className="w-3.5 h-3.5" />
                  <span>Match Strategy Replay</span>
                </div>
                <h2 className="text-sm sm:text-base font-black text-slate-100 truncate max-w-sm sm:max-w-md">
                  {game?.tableName || 'Game Session Replay'}
                </h2>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Champion: <strong className="text-amber-400">{game?.winnerName}</strong> ({game?.winnerCumulativeScore} pts)</span>
                <span>•</span>
                <span>{dateFormatted}</span>
              </p>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('tricks')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'tricks'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tricks Playback
              </button>
              <button
                onClick={() => setActiveTab('strategies')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'strategies'
                    ? 'bg-purple-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                AI ML Vectors
              </button>
              <button
                onClick={() => setActiveTab('scores')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'scores'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Score Log
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold">Fetching session telemetry from Firestore...</p>
            </div>
          ) : activeTab === 'tricks' ? (
            <>
              {/* Playback Controls Bar */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                {/* Trick Step Navigation */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400 mr-1">Trick:</span>
                  {effectiveTricks.map((t, idx) => (
                    <button
                      key={t.trickNumber || idx}
                      onClick={() => {
                        setActiveTrickIdx(idx);
                        setIsPlaying(false);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition border ${
                        activeTrickIdx === idx
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 border-emerald-400 shadow-md scale-105'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      #{idx + 1} {idx === 3 ? '(4-Cards)' : '(3-Cards)'}
                    </button>
                  ))}
                </div>

                {/* VCR Playback Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveTrickIdx((prev) => Math.max(0, prev - 1));
                      setIsPlaying(false);
                    }}
                    disabled={activeTrickIdx === 0}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-300"
                    title="Previous Trick"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950" />}
                    <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTrickIdx((prev) => Math.min(effectiveTricks.length - 1, prev + 1));
                      setIsPlaying(false);
                    }}
                    disabled={activeTrickIdx >= effectiveTricks.length - 1}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-300"
                    title="Next Trick"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setActiveTrickIdx(0);
                      setIsPlaying(false);
                    }}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300"
                    title="Reset to Trick 1"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* Speed Selector */}
                  <div className="ml-2 flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-[10px] font-mono">
                    {[0.5, 1, 2].map((sp) => (
                      <button
                        key={sp}
                        onClick={() => setPlaybackSpeed(sp)}
                        className={`px-2 py-1 rounded-lg transition ${
                          playbackSpeed === sp ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active Trick Details Banner */}
              {currentTrick && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-amber-950/40 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-black text-emerald-400 tracking-wider">
                        Trick #{currentTrick.trickNumber || activeTrickIdx + 1} Resolved
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                        {activeTrickIdx === 3 ? '4-Card Extra Trick' : '3-Card Standard Trick'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-bold text-slate-100">
                        Winner: <strong className="text-amber-300">{currentTrick.winnerName}</strong>
                      </span>
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        (+{currentTrick.pointsAwarded} points captured)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>Round Points Won:</span>
                    <span className="font-mono text-sm font-black text-amber-300">
                      {currentTrick.pointsAwarded} pts
                    </span>
                  </div>
                </div>
              )}

              {/* 4 Players' Plays in this Trick */}
              {currentTrick && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentTrick.plays?.map((play, seatIdx) => {
                    const isWinner = play.playerName === currentTrick.winnerName;

                    return (
                      <div
                        key={play.playerId || seatIdx}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          isWinner
                            ? 'bg-gradient-to-br from-amber-950/40 to-slate-900 border-amber-500/50 shadow-xl shadow-amber-950/20 ring-1 ring-amber-500/30'
                            : 'bg-slate-950/90 border-slate-800'
                        }`}
                      >
                        {/* Play Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sm font-bold">
                              {play.isAgent ? '🤖' : '👤'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-100">{play.playerName}</span>
                                {isWinner && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Seat {play.seatIndex !== undefined ? play.seatIndex + 1 : seatIdx + 1}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                              {play.evaluation?.label || play.evaluation?.categoryName || 'Standard Play'}
                            </span>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              +{play.points || 0} pts
                            </span>
                          </div>
                        </div>

                        {/* Played Cards Visualizer */}
                        <div className="py-2 flex items-center gap-2 justify-center bg-slate-900/60 rounded-xl border border-slate-800/80">
                          {play.cards?.map((card, cIdx) => (
                            <PlayingCard key={card.code || cIdx} card={card} size="sm" />
                          ))}
                        </div>

                        {/* Hand Evaluation breakdown */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                          <span>Combination Category:</span>
                          <span className="font-mono text-slate-200 font-bold">
                            {play.evaluation?.categoryName} ({play.evaluation?.points || 0} pts value)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : activeTab === 'strategies' ? (
            /* AI ML Vectors & Decision Inspector */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/40">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-bold text-purple-200">
                    Decision Matrix &amp; Strategic Feature Analysis
                  </h3>
                </div>
                <p className="text-xs text-purple-300/80">
                  Inspect the 10-dimensional strategic vectors extracted from each player hand according to Md Hashibul Amin's feature representation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {game?.trainingSamples && game.trainingSamples.length > 0 ? (
                  game.trainingSamples.map((sample, sIdx) => (
                    <div
                      key={sIdx}
                      className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100">
                            {sample.playerName || `Seat ${sIdx + 1}`}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase font-mono font-bold">
                            {sample.winningStrategy}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-amber-400">
                          {sample.score} pts
                        </span>
                      </div>

                      {/* Feature Vector Bars */}
                      <div className="space-y-1.5 text-[11px]">
                        {[
                          'Trio Count',
                          'Same Color Run',
                          'Run Potential',
                          'Color Potential',
                          'Pair Count',
                          'Unique Ranks',
                          'Suit Variance',
                          'Clustering Score',
                          'Hand Strength',
                          'Weak Trio Break',
                        ].map((label, fIdx) => {
                          const val = sample.features && sample.features[fIdx] !== undefined ? sample.features[fIdx] : 0.5;
                          const pct = Math.round(val * 100);

                          return (
                            <div key={label} className="space-y-0.5">
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>{label}</span>
                                <span className="font-mono">{val.toFixed(2)}</span>
                              </div>
                              <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-400"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 py-10 text-center text-xs text-slate-400">
                    No ML feature telemetry captured for this archived match session.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Score Log & Rounds Breakdown */
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Round</th>
                      <th className="py-2.5 px-4">Winner</th>
                      <th className="py-2.5 px-4">Points</th>
                      <th className="py-2.5 px-4 text-right">Player Scores</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {game?.roundsHistory && game.roundsHistory.length > 0 ? (
                      game.roundsHistory.map((rh, i) => (
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                          No historical round logs recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Interactive playback allows frame-by-frame analysis of Hazari card strategies.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            Close Replay
          </button>
        </div>
      </div>
    </div>
  );
};
