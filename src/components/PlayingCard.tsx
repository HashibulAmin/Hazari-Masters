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
    sm: 'w-10 h-14 text-xs rounded-md',
    md: 'w-14 h-20 text-sm rounded-lg',
    lg: 'w-18 h-26 text-base rounded-xl',
  }[size];

  if (isFaceDown || !card) {
    return (
      <div
        onClick={onClick}
        className={`${sizeClasses} ${className} relative flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 border border-indigo-400/40 shadow-md cursor-pointer select-none transition-transform hover:-translate-y-1`}
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
        border transition-all duration-150 select-none cursor-pointer
        ${
          isSelected
            ? 'ring-2 ring-amber-400 -translate-y-2.5 shadow-xl border-amber-400 scale-105'
            : 'border-slate-300 shadow-md hover:-translate-y-1 hover:shadow-lg'
        }
      `}
    >
      {/* Top Left Rank & Suit */}
      <div className={`flex flex-col items-start leading-none font-bold ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        <span className="font-serif tracking-tighter">{card.rank}</span>
        <span className="text-[11px] leading-tight">{card.suit}</span>
      </div>

      {/* Center Large Suit Symbol */}
      <div className={`self-center text-lg leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {card.suit}
      </div>

      {/* Bottom Right Rank & Points Badge */}
      <div className="flex items-end justify-between leading-none">
        {showPoints && (
          <span className={`text-[9px] font-mono font-semibold px-1 rounded ${card.points === 10 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'}`}>
            {card.points}p
          </span>
        )}
        <div className={`flex flex-col items-end rotate-180 font-bold ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
          <span className="font-serif tracking-tighter">{card.rank}</span>
        </div>
      </div>
    </div>
  );
};
