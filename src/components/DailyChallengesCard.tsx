import React, { useState, useEffect } from 'react';
import {
  UserChallengeProfile,
  DailyArrangementChallenge,
  getOrInitDailyChallenges,
  claimChallengeReward,
} from '../services/dailyChallengesService';
import {
  Trophy,
  Crown,
  Sparkles,
  Flame,
  Layers,
  Brain,
  Shield,
  Target,
  Zap,
  Award,
  CheckCircle2,
  Clock,
  RefreshCw,
  Gift,
  ChevronDown,
  ChevronUp,
  Star,
  Swords,
  Play,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../utils/soundEffects';

interface DailyChallengesCardProps {
  userId: string;
  userName: string;
  audioEnabled?: boolean;
  onPlayNow?: () => void;
}

export const DailyChallengesCard: React.FC<DailyChallengesCardProps> = ({
  userId,
  userName,
  audioEnabled = true,
  onPlayNow,
}) => {
  const [profile, setProfile] = useState<UserChallengeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [timeLeft, setTimeLeft] = useState('');

  const loadChallenges = async () => {
    setIsRefreshing(true);
    try {
      const data = await getOrInitDailyChallenges(userId);
      setProfile(data);
    } catch (err) {
      console.warn('Failed to load daily challenges:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadChallenges();
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

  const handleClaim = async (challengeId: string) => {
    try {
      if (audioEnabled) sounds.playVictoryFanfare();
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
      });
      const updated = await claimChallengeReward(userId, challengeId);
      setProfile(updated);
    } catch (err) {
      console.warn('Failed to claim challenge reward:', err);
    }
  };

  const getChallengeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Crown':
        return <Crown className="w-4 h-4 text-amber-400" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'Flame':
        return <Flame className="w-4 h-4 text-rose-400" />;
      case 'Layers':
        return <Layers className="w-4 h-4 text-sky-400" />;
      case 'Brain':
        return <Brain className="w-4 h-4 text-purple-400" />;
      case 'Shield':
        return <Shield className="w-4 h-4 text-indigo-400" />;
      case 'Target':
        return <Target className="w-4 h-4 text-amber-400" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'Award':
      default:
        return <Award className="w-4 h-4 text-emerald-400" />;
    }
  };

  if (loading || !profile) {
    return (
      <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 animate-pulse flex items-center justify-between">
        <div className="h-6 bg-slate-800 rounded w-48" />
        <div className="h-6 bg-slate-800 rounded w-24" />
      </div>
    );
  }

  const allCompleted = profile.challenges.every((c) => c.isCompleted);
  const xpPercent = Math.min(
    100,
    Math.round((profile.currentLevelXp / (profile.nextLevelXp || 300)) * 100)
  );

  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 p-5 sm:p-6 shadow-xl relative overflow-hidden transition-all">
      {/* Background glow decoration */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Daily Challenges
            </span>
            <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              {profile.streakDays}-Day Streak
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2">
              Unique Card-Arrangement Goals
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {profile.completedCount}/{profile.challenges.length} Done
            </span>
          </div>
        </div>

        {/* Level Progression & Countdown Box */}
        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
          {/* Level Box */}
          <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-black font-serif flex items-center justify-center text-sm shadow">
              L{profile.currentLevel}
            </div>
            <div className="pr-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-200">{profile.levelTitle}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-indigo-300 font-mono font-bold">
                  {profile.currentLevelXp}/{profile.nextLevelXp} XP
                </span>
              </div>
            </div>
          </div>

          {/* Time & Expand Toggle */}
          <div className="flex items-center gap-1.5">
            <div className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 font-mono">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{timeLeft}</span>
            </div>

            <button
              onClick={loadChallenges}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"
              title="Refresh Daily Challenges"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"
              title={isExpanded ? 'Collapse Challenges' : 'Expand Challenges'}
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Challenges Content List */}
      {isExpanded && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {profile.challenges.map((challenge) => {
              const percent = Math.min(100, Math.round((challenge.current / challenge.target) * 100));

              return (
                <div
                  key={challenge.id}
                  className={`p-4 rounded-2xl border transition shadow-lg flex flex-col justify-between gap-3 ${
                    challenge.isClaimed
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-80'
                      : challenge.isCompleted
                      ? 'bg-gradient-to-br from-indigo-950/40 to-slate-900 border-indigo-500/60 ring-1 ring-indigo-500/40'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Top Type Badge and XP Reward */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                          {getChallengeIcon(challenge.icon)}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300">
                          {challenge.badge}
                        </span>
                      </div>

                      <span className="text-[11px] font-black font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400" />
                        +{challenge.rewardXp} XP
                      </span>
                    </div>

                    {/* Title & Instruction */}
                    <div>
                      <h4 className="text-xs font-black text-slate-100">{challenge.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {challenge.description}
                      </p>
                      <p className="text-[10px] text-indigo-400/90 italic mt-1 font-mono">
                        Goal: {challenge.instruction}
                      </p>
                    </div>
                  </div>

                  {/* Progress & Claim Action */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Progress</span>
                      <span className="font-mono font-bold text-slate-200">
                        {challenge.current} / {challenge.target}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          challenge.isCompleted
                            ? 'bg-gradient-to-r from-emerald-500 to-indigo-400'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {/* Action Button */}
                    {challenge.isClaimed ? (
                      <div className="py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-500 text-xs font-bold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Claimed (+{challenge.rewardXp} XP)</span>
                      </div>
                    ) : challenge.isCompleted ? (
                      <button
                        onClick={() => handleClaim(challenge.id)}
                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition transform hover:scale-102 active:scale-98 flex items-center justify-center gap-1.5"
                      >
                        <Gift className="w-3.5 h-3.5 fill-slate-950" />
                        <span>Claim +{challenge.rewardXp} XP</span>
                      </button>
                    ) : (
                      <button
                        onClick={onPlayNow}
                        className="w-full py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3 h-3 text-indigo-400" />
                        <span>Attempt in Game</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All Completed Champion Bonus Banner */}
          {allCompleted && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-indigo-950/40 to-slate-900 border border-amber-500/40 flex items-center justify-between text-xs animate-pulse">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-100">
                  Championship Master! All daily arrangement challenges completed today.
                </span>
              </div>
              <span className="text-[10px] text-amber-300 font-mono font-bold">
                Reset in {timeLeft}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
