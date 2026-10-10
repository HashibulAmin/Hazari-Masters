import React from 'react';
import { Trophy, Crown, Shield, Medal, Sparkles, Flame, Award, Zap } from 'lucide-react';

export type RankTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'MASTER';

export interface RankInfo {
  tier: RankTier;
  label: string;
  minScore: number;
  maxScore: number | null;
  colorBg: string;
  colorText: string;
  colorBorder: string;
  badgeGradient: string;
  icon: React.ReactNode;
}

export function getRankInfo(score: number): RankInfo {
  const safeScore = Math.max(0, score || 0);

  if (safeScore >= 20000) {
    return {
      tier: 'MASTER',
      label: 'Grandmaster',
      minScore: 20000,
      maxScore: null,
      colorBg: 'bg-purple-500/20',
      colorText: 'text-purple-300',
      colorBorder: 'border-purple-400/50',
      badgeGradient: 'from-purple-600 via-pink-600 to-amber-400',
      icon: <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />,
    };
  }

  if (safeScore >= 10000) {
    return {
      tier: 'PLATINUM',
      label: 'Platinum Elite',
      minScore: 10000,
      maxScore: 20000,
      colorBg: 'bg-cyan-500/20',
      colorText: 'text-cyan-300',
      colorBorder: 'border-cyan-400/40',
      badgeGradient: 'from-cyan-500 to-blue-600',
      icon: <Zap className="w-3.5 h-3.5 text-cyan-300" />,
    };
  }

  if (safeScore >= 5000) {
    return {
      tier: 'GOLD',
      label: 'Gold Champion',
      minScore: 5000,
      maxScore: 10000,
      colorBg: 'bg-amber-500/20',
      colorText: 'text-amber-300',
      colorBorder: 'border-amber-400/50',
      badgeGradient: 'from-amber-400 to-yellow-600',
      icon: <Crown className="w-3.5 h-3.5 text-amber-300" />,
    };
  }

  if (safeScore >= 1000) {
    return {
      tier: 'SILVER',
      label: 'Silver Striker',
      minScore: 1000,
      maxScore: 5000,
      colorBg: 'bg-slate-300/15',
      colorText: 'text-slate-200',
      colorBorder: 'border-slate-400/40',
      badgeGradient: 'from-slate-300 to-slate-500',
      icon: <Shield className="w-3.5 h-3.5 text-slate-300" />,
    };
  }

  return {
    tier: 'BRONZE',
    label: 'Bronze Rookie',
    minScore: 0,
    maxScore: 1000,
    colorBg: 'bg-amber-900/30',
    colorText: 'text-amber-500',
    colorBorder: 'border-amber-700/50',
    badgeGradient: 'from-amber-700 to-orange-900',
    icon: <Medal className="w-3.5 h-3.5 text-amber-500" />,
  };
}

interface PlayerRankBadgeProps {
  score: number;
  showLabel?: boolean;
  showScore?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const PlayerRankBadge: React.FC<PlayerRankBadgeProps> = ({
  score,
  showLabel = true,
  showScore = false,
  size = 'sm',
  className = '',
}) => {
  const rank = getRankInfo(score);

  const sizeClasses = {
    xs: 'text-[9px] px-1.5 py-0.5 gap-1',
    sm: 'text-[10px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-2',
    lg: 'text-sm px-3.5 py-1.5 gap-2.5',
  }[size];

  // Calculate progress to next rank
  let progressPct = 100;
  let ptsToNext = 0;
  if (rank.maxScore) {
    const range = rank.maxScore - rank.minScore;
    const currentInRange = score - rank.minScore;
    progressPct = Math.min(100, Math.max(0, Math.round((currentInRange / range) * 100)));
    ptsToNext = rank.maxScore - score;
  }

  return (
    <div
      className={`inline-flex items-center rounded-full font-bold border backdrop-blur-sm shadow-sm transition hover:scale-105 select-none ${rank.colorBg} ${rank.colorText} ${rank.colorBorder} ${sizeClasses} ${className}`}
      title={`${rank.label} (${score} cumulative pts)${ptsToNext > 0 ? ` • ${ptsToNext} pts to next rank` : ' • Max Tier'}`}
    >
      <div className="shrink-0">{rank.icon}</div>
      {showLabel && <span className="tracking-wide uppercase font-black">{rank.label}</span>}
      {showScore && <span className="font-mono opacity-80 font-normal">({score} pts)</span>}
    </div>
  );
};
