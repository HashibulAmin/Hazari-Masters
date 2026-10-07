import React, { useState, useEffect } from 'react';
import {
  DailyMission,
  DailyMissionsDoc,
  getOrInitDailyMissions,
  claimMissionReward,
  getTodayDateKey,
} from '../services/dailyMissionsService';
import {
  Trophy,
  Target,
  Gamepad2,
  Sparkles,
  Zap,
  Shield,
  Award,
  CheckCircle2,
  Gift,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Coins,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/soundEffects';

interface DailyMissionsCardProps {
  userId: string;
  userName: string;
  audioEnabled?: boolean;
}

export const DailyMissionsCard: React.FC<DailyMissionsCardProps> = ({
  userId,
  userName,
  audioEnabled = true,
}) => {
  const [data, setData] = useState<DailyMissionsDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const loadMissions = async () => {
    setIsRefreshing(true);
    try {
      const docData = await getOrInitDailyMissions(userId);
      setData(docData);
    } catch (err) {
      console.warn('Failed to load daily missions:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMissions();
  }, [userId]);

  // Countdown timer to midnight
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diffMs = midnight.getTime() - now.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClaim = async (missionId: string) => {
    try {
      if (audioEnabled) sounds.playVictoryFanfare();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
      const updated = await claimMissionReward(userId, missionId);
      setData(updated);
    } catch (err) {
      console.warn('Failed to claim mission:', err);
    }
  };

  const getMissionIcon = (iconName: string) => {
    switch (iconName) {
      case 'Trophy':
        return <Trophy className="w-4 h-4 text-amber-400" />;
      case 'Target':
        return <Target className="w-4 h-4 text-emerald-400" />;
      case 'Gamepad2':
        return <Gamepad2 className="w-4 h-4 text-indigo-400" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4 text-yellow-400" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-amber-300" />;
      case 'Shield':
        return <Shield className="w-4 h-4 text-purple-400" />;
      default:
        return <Award className="w-4 h-4 text-sky-400" />;
    }
  };

  const completedCount = data?.missions.filter((m) => m.isCompleted).length || 0;
  const totalMissions = data?.missions.length || 3;
  const allCompleted = completedCount === totalMissions && totalMissions > 0;

  return (
    <div className="w-full rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 shadow-xl overflow-hidden transition-all">
      {/* Header bar */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Gift className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">
                Daily Objectives
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                {completedCount} / {totalMissions} Done
              </span>
              {allCompleted && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> All Claimed!
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>Resets in: <strong className="text-slate-300 font-mono">{timeLeft}</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={loadMissions}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Refresh Missions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Body missions list */}
      {isExpanded && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {loading ? (
            <div className="col-span-3 py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Loading today's challenges...</span>
            </div>
          ) : (
            data?.missions.map((mission) => {
              const pct = Math.min(100, Math.round((mission.current / mission.target) * 100));

              return (
                <div
                  key={mission.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                    mission.isClaimed
                      ? 'bg-slate-950/70 border-slate-800/60 opacity-80'
                      : mission.isCompleted
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-950/30 shadow-lg'
                      : 'bg-slate-950/90 border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                          {getMissionIcon(mission.icon)}
                        </div>
                        <span className="text-xs font-bold text-slate-200">{mission.title}</span>
                      </div>

                      {mission.isClaimed ? (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Claimed
                        </span>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-300">
                          <Coins className="w-3 h-3 text-amber-400" />
                          <span>+{mission.rewardChips}</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">
                      {mission.description}
                    </p>
                  </div>

                  <div>
                    {/* Progress bar */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                      <span>Progress</span>
                      <span className={mission.isCompleted ? 'text-emerald-400 font-bold' : ''}>
                        {mission.current} / {mission.target} ({pct}%)
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          mission.isCompleted
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Action button if completed & not claimed */}
                    {mission.isCompleted && !mission.isClaimed && (
                      <button
                        onClick={() => handleClaim(mission.id)}
                        className="mt-2.5 w-full py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-amber-400 hover:from-emerald-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 animate-pulse"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Claim Reward (+{mission.rewardChips} chips)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
