import React from 'react';
import { BookOpen } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-xl max-h-[85vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">Hazari Official Game Rules</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-300 leading-relaxed">
          <section className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
            <h3 className="font-bold text-emerald-400 text-sm mb-1">Objective</h3>
            <p>
              &ldquo;Hazari&rdquo; means 1000 in Bengali. 4 players compete using a standard 52-card deck. The first player to reach or exceed <strong>1000 cumulative points</strong> is declared the champion!
            </p>
          </section>

          <section className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
            <h3 className="font-bold text-amber-400 text-sm mb-1">Card Point Values (360 pts per deck)</h3>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="font-bold text-slate-200">10 Points Each:</span>
                <p className="text-slate-400">A, K, Q, J, 10 (4 each = 200 pts)</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="font-bold text-slate-200">5 Points Each:</span>
                <p className="text-slate-400">9, 8, 7, 6, 5, 4, 3, 2 (32 cards = 160 pts)</p>
              </div>
            </div>
          </section>

          <section className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
            <h3 className="font-bold text-sky-400 text-sm mb-1">Arrangement Hierarchy (Highest to Lowest)</h3>
            <ul className="space-y-1.5 mt-2">
              <li className="flex items-center justify-between p-1.5 rounded bg-slate-900">
                <span className="font-bold text-slate-200">1. Troy (Trial)</span>
                <span className="text-slate-400">Three cards of the same rank (e.g. A-A-A, K-K-K)</span>
              </li>
              <li className="flex items-center justify-between p-1.5 rounded bg-slate-900">
                <span className="font-bold text-slate-200">2. Colour Run (Straight Flush)</span>
                <span className="text-slate-400">Three consecutive cards of the same suit (A-K-Q, A-2-3)</span>
              </li>
              <li className="flex items-center justify-between p-1.5 rounded bg-slate-900">
                <span className="font-bold text-slate-200">3. Run (Straight)</span>
                <span className="text-slate-400">Three consecutive cards of mixed suits</span>
              </li>
              <li className="flex items-center justify-between p-1.5 rounded bg-slate-900">
                <span className="font-bold text-slate-200">4. Colour (Flush)</span>
                <span className="text-slate-400">Three cards of the same suit, not consecutive</span>
              </li>
              <li className="flex items-center justify-between p-1.5 rounded bg-slate-900">
                <span className="font-bold text-slate-200">5. Pair</span>
                <span className="text-slate-400">Two cards of the same rank + 1 kicker</span>
              </li>
              <li className="flex items-center justify-between p-1.5 rounded bg-slate-900">
                <span className="font-bold text-slate-200">6. Indi (High Card)</span>
                <span className="text-slate-400">None of the above; ranked by highest card</span>
              </li>
            </ul>
          </section>

          <section className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
            <h3 className="font-bold text-purple-400 text-sm mb-1">Trick Play & Tie-breaking</h3>
            <p>
              Each player arranges their 13 cards into 3 groups of 3 cards and 1 extra group of 4 cards (Group 1 ≥ Group 2 ≥ Group 3).
              In each of the 4 tricks, players reveal their group in turn.
              <strong>Tie-breaker rule:</strong> If two played groups evaluate equally, the <strong>last played wins</strong>! The trick winner collects all card points from the trick and leads the next trick.
            </p>
          </section>
        </div>

        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition"
          >
            Got It, Let&apos;s Play!
          </button>
        </div>
      </div>
    </div>
  );
};
