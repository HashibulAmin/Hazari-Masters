import React, { useState } from 'react';
import { useSoundManager } from '../hooks/useSoundManager';
import { PlayerRankBadge, getRankInfo } from './PlayerRankBadge';
import {
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Trophy,
  Shield,
  Medal,
  Crown,
  Play,
  Check,
  X,
  Bell,
  Layers,
  Settings,
  HelpCircle,
} from 'lucide-react';

interface UserPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserScore?: number;
  currentUserName?: string;
}

export const UserPreferencesModal: React.FC<UserPreferencesModalProps> = ({
  isOpen,
  onClose,
  currentUserScore = 0,
  currentUserName = 'Player',
}) => {
  const {
    preferences,
    updatePreferences,
    toggleMaster,
    setVolume,
    playDeal,
    playCardPlay,
    playTrickWin,
    playDeclare,
    playVictory,
  } = useSoundManager();

  const [activeTab, setActiveTab] = useState<'audio' | 'rank' | 'rules'>('audio');

  if (!isOpen) return null;

  const currentRank = getRankInfo(currentUserScore);
  const nextRankThreshold = currentRank.maxScore;
  const progressToNext = nextRankThreshold
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((currentUserScore - currentRank.minScore) /
              (nextRankThreshold - currentRank.minScore)) *
              100
          )
        )
      )
    : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-emerald-950/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-100 uppercase tracking-wide">
                User Preferences &amp; Settings
              </h2>
              <p className="text-xs text-slate-400">
                Custom sound manager, audio feedback toggles, and player rank status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="px-5 pt-3 pb-1 border-b border-slate-800/60 flex items-center gap-2 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'audio'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Audio &amp; Sound Manager</span>
          </button>
          <button
            onClick={() => setActiveTab('rank')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'rank'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Rank Progression</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'audio' && (
            <div className="space-y-5">
              {/* Master Audio Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 shadow-md flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleMaster}
                    className={`p-3 rounded-2xl transition border ${
                      preferences.masterEnabled
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {preferences.masterEnabled ? (
                      <Volume2 className="w-5 h-5" />
                    ) : (
                      <VolumeX className="w-5 h-5" />
                    )}
                  </button>
                  <div>
                    <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <span>Master Audio Feedback</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          preferences.masterEnabled
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {preferences.masterEnabled ? 'Enabled' : 'Muted'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Toggle synthesizer card room acoustics and trick sound effects
                    </p>
                  </div>
                </div>

                <button
                  onClick={toggleMaster}
                  className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
                    preferences.masterEnabled
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                  }`}
                >
                  {preferences.masterEnabled ? 'Mute All' : 'Unmute All'}
                </button>
              </div>

              {/* Volume Slider */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Master SFX Volume</span>
                  </span>
                  <span className="font-mono text-emerald-400">{preferences.volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={preferences.volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  disabled={!preferences.masterEnabled}
                  className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
                />
              </div>

              {/* Individual Sound Events */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Critical Game Audio Events
                </h3>

                {/* 1. Dealing Cards */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-200">Card Dealing (Deal Shuffle)</div>
                    <div className="text-[11px] text-slate-400">
                      Whoosh sound when 13 cards are dealt to seats
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => playDeal()}
                      disabled={!preferences.masterEnabled || !preferences.dealSound}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 disabled:opacity-30 transition flex items-center gap-1"
                      title="Test Deal Sound"
                    >
                      <Play className="w-3 h-3 text-emerald-400" />
                      <span>Test</span>
                    </button>
                    <button
                      onClick={() => updatePreferences({ dealSound: !preferences.dealSound })}
                      className={`w-11 h-6 rounded-full transition p-0.5 ${
                        preferences.dealSound && preferences.masterEnabled
                          ? 'bg-emerald-500'
                          : 'bg-slate-800'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transition transform ${
                          preferences.dealSound && preferences.masterEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 2. Playing a Card */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-200">Playing a Card into Center</div>
                    <div className="text-[11px] text-slate-400">
                      Crisp card snap when cards hit the table
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => playCardPlay()}
                      disabled={!preferences.masterEnabled || !preferences.cardPlaySound}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 disabled:opacity-30 transition flex items-center gap-1"
                      title="Test Card Play Sound"
                    >
                      <Play className="w-3 h-3 text-emerald-400" />
                      <span>Test</span>
                    </button>
                    <button
                      onClick={() => updatePreferences({ cardPlaySound: !preferences.cardPlaySound })}
                      className={`w-11 h-6 rounded-full transition p-0.5 ${
                        preferences.cardPlaySound && preferences.masterEnabled
                          ? 'bg-emerald-500'
                          : 'bg-slate-800'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transition transform ${
                          preferences.cardPlaySound && preferences.masterEnabled
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 3. Winning a Trick */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-200">Winning a Trick</div>
                    <div className="text-[11px] text-slate-400">
                      Harmonic chime when a trick winner collects points
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => playTrickWin()}
                      disabled={!preferences.masterEnabled || !preferences.trickWinSound}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 disabled:opacity-30 transition flex items-center gap-1"
                      title="Test Trick Win Sound"
                    >
                      <Play className="w-3 h-3 text-emerald-400" />
                      <span>Test</span>
                    </button>
                    <button
                      onClick={() => updatePreferences({ trickWinSound: !preferences.trickWinSound })}
                      className={`w-11 h-6 rounded-full transition p-0.5 ${
                        preferences.trickWinSound && preferences.masterEnabled
                          ? 'bg-emerald-500'
                          : 'bg-slate-800'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transition transform ${
                          preferences.trickWinSound && preferences.masterEnabled
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 4. Calling a Declare / Hand Ready */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-200">Calling a Declare (Hand Ready)</div>
                    <div className="text-[11px] text-slate-400">
                      Ascending triad bell confirming 4-group arrangement lock
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => playDeclare()}
                      disabled={!preferences.masterEnabled || !preferences.declareSound}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 disabled:opacity-30 transition flex items-center gap-1"
                      title="Test Declare Sound"
                    >
                      <Play className="w-3 h-3 text-emerald-400" />
                      <span>Test</span>
                    </button>
                    <button
                      onClick={() => updatePreferences({ declareSound: !preferences.declareSound })}
                      className={`w-11 h-6 rounded-full transition p-0.5 ${
                        preferences.declareSound && preferences.masterEnabled
                          ? 'bg-emerald-500'
                          : 'bg-slate-800'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transition transform ${
                          preferences.declareSound && preferences.masterEnabled
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 5. Tournament Victory Fanfare */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-200">1000-Point Championship Fanfare</div>
                    <div className="text-[11px] text-slate-400">
                      Triumphant melody when tournament champion crowns 1000 pts
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => playVictory()}
                      disabled={!preferences.masterEnabled || !preferences.victorySound}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 disabled:opacity-30 transition flex items-center gap-1"
                      title="Test Victory Fanfare"
                    >
                      <Play className="w-3 h-3 text-amber-400" />
                      <span>Test</span>
                    </button>
                    <button
                      onClick={() => updatePreferences({ victorySound: !preferences.victorySound })}
                      className={`w-11 h-6 rounded-full transition p-0.5 ${
                        preferences.victorySound && preferences.masterEnabled
                          ? 'bg-emerald-500'
                          : 'bg-slate-800'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transition transform ${
                          preferences.victorySound && preferences.masterEnabled
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rank' && (
            <div className="space-y-4">
              {/* Current Status */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Current Standing</span>
                  <div className="text-base font-black text-slate-100 flex items-center gap-2 mt-0.5">
                    <span>{currentUserName}</span>
                    <PlayerRankBadge score={currentUserScore} size="sm" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Cumulative Hazari Score:{' '}
                    <span className="font-mono font-bold text-amber-400">{currentUserScore} pts</span>
                  </p>
                </div>
              </div>

              {/* Progress to next tier */}
              {nextRankThreshold && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold">Progress to Next Rank</span>
                    <span className="font-mono text-emerald-400 font-bold">{progressToNext}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${progressToNext}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{currentRank.minScore} pts</span>
                    <span>Next Rank: {nextRankThreshold} pts</span>
                  </div>
                </div>
              )}

              {/* All Tiers Guide */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Championship Rank Hierarchy
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-900/40 flex items-center gap-3">
                    <Medal className="w-4 h-4 text-amber-600" />
                    <div>
                      <div className="font-bold text-amber-500">Bronze Rookie</div>
                      <div className="text-[10px] text-slate-400 font-mono">0 – 999 pts</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-700/40 flex items-center gap-3">
                    <Shield className="w-4 h-4 text-slate-300" />
                    <div>
                      <div className="font-bold text-slate-200">Silver Striker</div>
                      <div className="text-[10px] text-slate-400 font-mono">1,000 – 4,999 pts</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center gap-3">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-bold text-amber-300">Gold Champion</div>
                      <div className="text-[10px] text-slate-400 font-mono">5,000 – 9,999 pts</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/40 flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                    <div>
                      <div className="font-bold text-purple-300">Grandmaster</div>
                      <div className="text-[10px] text-slate-400 font-mono">20,000+ pts</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/90 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
