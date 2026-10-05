import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { TableState } from '../core/hazari/types';
import { Trophy, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

interface GameWinModalProps {
  tableState: TableState;
  onShuffleTable: () => void;
  onCompleteGame?: () => void;
  audioEnabled: boolean;
}

export const GameWinModal: React.FC<GameWinModalProps> = ({
  tableState,
  onShuffleTable,
  onCompleteGame,
  audioEnabled,
}) => {
  const { gameWinnerSeat, players, targetScore } = tableState;

  useEffect(() => {
    if (gameWinnerSeat !== null && gameWinnerSeat !== undefined) {
      if (audioEnabled) sounds.playVictoryFanfare();
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [gameWinnerSeat, audioEnabled]);

  if (gameWinnerSeat === null || gameWinnerSeat === undefined) return null;

  const winner = players[gameWinnerSeat];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/50 p-6 shadow-2xl text-center flex flex-col items-center gap-4">
        {/* Animated Trophy */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 p-1 shadow-2xl animate-bounce">
          <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-3xl">
            🏆
          </div>
        </div>

        <div>
          <span className="text-xs uppercase tracking-widest font-black text-amber-400">
            Hazari Championship Winner
          </span>
          <h2 className="text-2xl font-black text-slate-100 mt-1">{winner.name}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Crossed the {targetScore}-point threshold with{' '}
            <strong className="text-amber-300 font-mono text-sm">{winner.cumulativeScore} points</strong>!
          </p>
        </div>

        {/* Final Standings */}
        <div className="w-full bg-slate-950/80 rounded-2xl border border-slate-800 p-3 space-y-2">
          {players.map((p, idx) => (
            <div
              key={p.id}
              className={`flex items-center justify-between text-xs p-2 rounded-xl ${
                idx === gameWinnerSeat ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{p.avatar}</span>
                <span>{p.name}</span>
                {idx === gameWinnerSeat && <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-black">1ST</span>}
              </div>
              <span className="font-mono">{p.cumulativeScore} pts</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={onShuffleTable}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl transition-all hover:scale-102 active:scale-98"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Shuffle Table &amp; Play Again</span>
          </button>

          {onCompleteGame && (
            <button
              onClick={onCompleteGame}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider border border-slate-700 hover:border-emerald-500 shadow-lg transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Finish &amp; Complete Game</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
