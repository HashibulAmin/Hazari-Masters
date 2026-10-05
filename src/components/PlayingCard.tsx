import React from 'react';
import { Card } from '../core/hazari/types';

interface PlayingCardProps {
  card?: Card;
  isFaceDown?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showPoints?: boolean;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  isFaceDown = false,
  isSelected = false,
  onClick,
  className = '',
  size = 'md',
  showPoints = true,
}) => {
  const isRed = card ? card.suit === '♥' || card.suit === '♦' : false;

  const sizeClasses = {
    sm: 'w-11 h-16 text-xs rounded-lg',
    md: 'w-14 h-20 text-sm rounded-xl',
    lg: 'w-18 h-26 text-base rounded-2xl',
  }[size];

  if (isFaceDown || !card) {
    return (
      <div
        onClick={onClick}
        className={`${sizeClasses} ${className} relative flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 border border-indigo-400/40 shadow-md cursor-pointer select-none transition-transform hover:-translate-y-1 overflow-hidden shrink-0`}
      >
        <div className="absolute inset-1 rounded border border-indigo-400/20 bg-radial from-indigo-500/20 to-transparent flex items-center justify-center">
          <div className="w-4 h-6 border border-amber-400/40 rounded-sm rotate-45 flex items-center justify-center">
            <span className="text-[10px] text-amber-300 font-serif">H</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`
        ${sizeClasses} ${className}
        relative flex flex-col justify-between p-1 bg-white
        border transition-all duration-150 select-none cursor-pointer overflow-hidden shrink-0 shadow-md
        ${
          isSelected
            ? 'ring-2 ring-amber-400 -translate-y-2 shadow-xl border-amber-400 scale-105'
            : 'border-slate-300 hover:-translate-y-1 hover:shadow-lg'
        }
      `}
    >
      {/* Top Left Rank & Suit Index */}
      <div className={`flex flex-col items-start leading-none font-bold ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        <span className="font-serif font-black tracking-tight text-[11px] sm:text-xs leading-none">
          {card.rank}
        </span>
        <span className="text-[10px] sm:text-[11px] leading-tight">
          {card.suit}
        </span>
      </div>

      {/* Center Large Suit Symbol */}
      <div className={`self-center text-sm sm:text-base leading-none select-none my-auto ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {card.suit}
      </div>

      {/* Bottom Footer: Points Badge and/or Mini Inverted Rank */}
      <div className="flex items-end justify-between leading-none w-full mt-auto">
        {showPoints ? (
          <span
            className={`text-[8px] font-mono font-bold px-0.5 rounded leading-tight ${
              card.points === 10 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {card.points}p
          </span>
        ) : (
          <div />
        )}

        {/* Bottom Inverted Index - Rendered only when height permits or micro-scaled so it never overflows */}
        <div className={`flex flex-col items-end rotate-180 font-bold ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
          <span className="font-serif font-black text-[9px] sm:text-[10px] leading-none">
            {card.rank}
          </span>
        </div>
      </div>
    </div>
  );
};
