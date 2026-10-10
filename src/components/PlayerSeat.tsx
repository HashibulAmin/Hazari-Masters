import React from 'react';
import { Player, TableStatus, TrickPlay } from '../core/hazari/types';
import { PlayingCard } from './PlayingCard';
import { PlayerRankBadge } from './PlayerRankBadge';
import { Bot, User, WifiOff, Crown, CheckCircle2, Clock } from 'lucide-react';

interface PlayerSeatProps {
  player: Player;
  isLocalPlayer: boolean;
  isCurrentTurn: boolean;
  isLead: boolean;
  isDealer: boolean;
  status: TableStatus;
  currentPlay?: TrickPlay;
  position: 'south' | 'north' | 'west' | 'east';
  onTakeSeat?: () => void;
  onLeaveSeat?: () => void;
  canPlayNow?: boolean;
  onPlayTrick?: () => void;
  winsCount?: number;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isLocalPlayer,
  isCurrentTurn,
  isLead,
  isDealer,
  status,
  currentPlay,
  position,
  onTakeSeat,
  onLeaveSeat,
  canPlayNow,
  onPlayTrick,
  winsCount = 0,
}) => {
  const isSouth = position === 'south';

  return (
    <div
      className={`
        relative flex flex-col items-center transition-all duration-300
        ${isLocalPlayer ? 'order-last' : ''}
      `}
    >
      {/* Turn Glow */}
      {isCurrentTurn && status === 'PLAYING_TRICK' && (
        <div className="absolute -inset-1.5 rounded-xl bg-amber-400/25 blur-md animate-pulse pointer-events-none" />
      )}

      {/* Main Seat Card Pod */}
      <div
        className={`
          relative z-10 flex items-center gap-2 p-1.5 sm:p-2 rounded-xl backdrop-blur-md shadow-lg border transition-all
          ${
            isCurrentTurn && status === 'PLAYING_TRICK'
              ? 'bg-slate-900/95 border-amber-400 shadow-amber-500/20 ring-1 ring-amber-400 scale-105'
              : isLocalPlayer
              ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-950/40'
              : 'bg-slate-900/80 border-slate-800'
          }
          w-[145px] sm:w-[165px]
        `}
      >
        {/* Avatar with Badges */}
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-base shadow-inner border border-slate-600/50">
            {player.avatar}
          </div>

          {/* Lead Puck */}
          {isLead && (
            <div
              className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow font-black text-[8px]"
              title="Trick Leader"
            >
              L
            </div>
          )}

          {/* Dealer Button */}
          {isDealer && (
            <div
              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow font-black text-[8px]"
              title="Table Dealer"
            >
              D
            </div>
          )}

          {/* Agent vs Human Badge */}
          <div
            className={`absolute -bottom-1 -right-1 p-0.5 rounded-full text-[8px] border ${
              player.isAgent
                ? 'bg-sky-950 text-sky-400 border-sky-600'
                : 'bg-emerald-950 text-emerald-400 border-emerald-600'
            }`}
            title={player.isAgent ? 'AI Agent' : 'Human Player'}
          >
            {player.isAgent ? <Bot className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
          </div>
        </div>

        {/* Details & Points */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-slate-200 truncate flex items-center gap-1">
              <span className="truncate">{player.name}</span>
              {isLocalPlayer && <span className="text-[9px] text-emerald-400 font-normal shrink-0">(You)</span>}
              <PlayerRankBadge score={player.cumulativeScore} size="xs" showLabel={false} className="shrink-0" />
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {winsCount > 0 && (
                <span className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded font-bold" title={`${winsCount} Tournament 1000-point Wins on this table`}>
                  🏆 {winsCount}W
                </span>
              )}
              <span className="text-[9px] text-slate-500 font-mono">S{player.seatIndex + 1}</span>
            </div>
          </div>

          {/* Score & Progress towards 1000 */}
          <div className="flex items-center justify-between text-[11px] leading-tight mt-0.5">
            <span className="font-mono font-bold text-amber-300">
              {player.cumulativeScore} <span className="text-[9px] text-amber-500/80 font-normal">pts</span>
            </span>
            {player.roundScore > 0 && (
              <span className="text-[9px] font-mono text-emerald-400">+{player.roundScore}</span>
            )}
          </div>

          {/* Progress bar to 1000 points */}
          <div className="mt-1 w-full h-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-300 transition-all duration-500"
              style={{ width: `${Math.min(100, (player.cumulativeScore / 1000) * 100)}%` }}
            />
          </div>

          {/* Status line */}
          <div className="mt-0.5 text-[9px] flex items-center justify-between truncate">
            {!player.connected ? (
              <span className="text-rose-400 flex items-center gap-0.5">
                <WifiOff className="w-2 h-2" /> Offline
              </span>
            ) : status === 'ARRANGING' ? (
              player.isReady ? (
                <span className="text-emerald-400 flex items-center gap-0.5 font-medium">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Ready (Up)
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-0.5">
                  <Clock className="w-2 h-2 animate-spin" /> Arranging...
                </span>
              )
            ) : isCurrentTurn && status === 'PLAYING_TRICK' ? (
              <span className="text-amber-300 font-bold animate-pulse">Playing turn...</span>
            ) : (
              <span className="text-slate-500">{player.isAgent ? 'Agent' : 'Online'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Play Trigger for Local Player on Their Turn */}
      {isLocalPlayer && canPlayNow && (
        <div className="mt-1 flex items-center gap-2">
          <button
            onClick={onPlayTrick}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition animate-pulse"
          >
            Play My Hand Now!
          </button>
        </div>
      )}

      {/* Seat Swapping / Handover Buttons */}
      <div className="mt-0.5 flex items-center gap-1">
        {!isLocalPlayer && player.isAgent && onTakeSeat && (
          <button
            onClick={onTakeSeat}
            className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-500 transition"
          >
            Take Seat {player.seatIndex + 1}
          </button>
        )}

        {isLocalPlayer && onLeaveSeat && (
          <button
            onClick={onLeaveSeat}
            className="text-[9px] px-1.5 py-0.5 rounded-md bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition"
            title="Step away and let an AI Agent play your hand"
          >
            Let Agent Play
          </button>
        )}
      </div>
    </div>
  );
};
