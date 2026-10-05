import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CompletedGameRecord, normalizeCompletedGameRecord } from '../firebase/tableService';
import {
  Trophy,
  Calendar,
  Award,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  LayoutList,
  LayoutGrid,
  ChevronRight,
  Sparkles,
  Users,
  Shield,
  Bot,
  User,
} from 'lucide-react';

interface CompletedGamesListProps {
  onSelectGame: (game: CompletedGameRecord) => void;
  searchQuery?: string;
}

export const CompletedGamesList: React.FC<CompletedGamesListProps> = ({
  onSelectGame,
  searchQuery = '',
}) => {
  const [games, setGames] = useState<CompletedGameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [filterText, setFilterText] = useState(searchQuery);

  // Directly fetch & subscribe to Firebase Firestore 'completed_games' collection
  const fetchGamesDirectly = async () => {
    setIsRefreshing(true);
    try {
      const snap = await getDocs(collection(db, 'completed_games'));
      const list: CompletedGameRecord[] = [];
      snap.forEach((d) => {
        list.push(normalizeCompletedGameRecord(d.data(), d.id));
      });
      list.sort((a, b) => b.completedAt - a.completedAt);
      setGames(list);
      if (typeof window !== 'undefined') {
        localStorage.setItem('hazari_completed_games_cache', JSON.stringify(list));
      }
    } catch (err) {
      console.warn('Direct getDocs completed_games error:', err);
      // Fallback to local cache
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('hazari_completed_games_cache');
        if (cached) {
          try {
            setGames(JSON.parse(cached));
          } catch {}
        }
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchGamesDirectly();

    // Real-time Firestore snapshot listener directly on 'completed_games' collection
    const gamesRef = collection(db, 'completed_games');
    const unsubscribe = onSnapshot(
      gamesRef,
      (snapshot) => {
        const list: CompletedGameRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(normalizeCompletedGameRecord(docSnap.data(), docSnap.id));
        });
        list.sort((a, b) => b.completedAt - a.completedAt);
        setGames(list);
        setLoading(false);
        if (typeof window !== 'undefined') {
          localStorage.setItem('hazari_completed_games_cache', JSON.stringify(list));
        }
      },
      (error) => {
        console.warn('Real-time snapshot completed_games notice:', error?.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Sync prop searchQuery with filterText
  useEffect(() => {
    if (searchQuery !== undefined) {
      setFilterText(searchQuery);
    }
  }, [searchQuery]);

  // Seed sample match directly to Firebase
  const handleSeedSampleMatch = async () => {
    setIsRefreshing(true);
    const sampleId = `game_session_${Date.now()}`;
    const now = Date.now();
    const sample: CompletedGameRecord = {
      gameId: sampleId,
      tableId: `table_${Date.now().toString(36)}`,
      tableName: 'Grand Masters 1000pt Tournament',
      completedAt: now,
      winnerId: 'winner_1',
      winnerName: 'Agent Kabir (#1)',
      winnerCumulativeScore: 1060,
      roundsHistory: [
        {
          roundNumber: 1,
          winnerName: 'Agent Kabir (#1)',
          pointsAwarded: 280,
          playerScores: [
            { playerName: 'Agent Kabir (#1)', roundScore: 280, cumulativeScore: 280 },
            { playerName: 'Agent Ananya (#2)', roundScore: 40, cumulativeScore: 40 },
            { playerName: 'Agent Tariq (#3)', roundScore: 20, cumulativeScore: 20 },
            { playerName: 'Agent Maya (#4)', roundScore: 20, cumulativeScore: 20 },
          ],
        },
        {
          roundNumber: 2,
          winnerName: 'Agent Kabir (#1)',
          pointsAwarded: 320,
          playerScores: [
            { playerName: 'Agent Kabir (#1)', roundScore: 320, cumulativeScore: 600 },
            { playerName: 'Agent Ananya (#2)', roundScore: 40, cumulativeScore: 80 },
            { playerName: 'Agent Tariq (#3)', roundScore: 0, cumulativeScore: 20 },
            { playerName: 'Agent Maya (#4)', roundScore: 0, cumulativeScore: 20 },
          ],
        },
        {
          roundNumber: 3,
          winnerName: 'Agent Kabir (#1)',
          pointsAwarded: 460,
          playerScores: [
            { playerName: 'Agent Kabir (#1)', roundScore: 460, cumulativeScore: 1060 },
            { playerName: 'Agent Ananya (#2)', roundScore: 120, cumulativeScore: 200 },
            { playerName: 'Agent Tariq (#3)', roundScore: 60, cumulativeScore: 80 },
            { playerName: 'Agent Maya (#4)', roundScore: 40, cumulativeScore: 60 },
          ],
        },
      ],
      players: [
        { id: 'winner_1', name: 'Agent Kabir (#1)', isAgent: true, cumulativeScore: 1060 },
        { id: 'player_2', name: 'Agent Ananya (#2)', isAgent: true, cumulativeScore: 200 },
        { id: 'player_3', name: 'Agent Tariq (#3)', isAgent: true, cumulativeScore: 80 },
        { id: 'player_4', name: 'Agent Maya (#4)', isAgent: true, cumulativeScore: 60 },
      ],
      closedBy: ['user'],
      isTrainedForGlobalModel: false,
      trainedForUserIds: [],
      trainingSamples: [
        { features: [0.9, 0.8, 0.7, 0.6, 0.85, 0.4, 0.7, 0.5, 0.8, 0.3], winningStrategy: 'optimal_ev', score: 1060 },
        { features: [0.5, 0.3, 0.6, 0.4, 0.4, 0.5, 0.6, 0.4, 0.5, 0.2], winningStrategy: 'balanced', score: 200 },
        { features: [0.4, 0.2, 0.5, 0.3, 0.3, 0.6, 0.5, 0.3, 0.4, 0.1], winningStrategy: 'defensive', score: 80 },
        { features: [0.3, 0.1, 0.4, 0.2, 0.3, 0.7, 0.4, 0.2, 0.3, 0.1], winningStrategy: 'defensive', score: 60 },
      ],
    };

    try {
      await setDoc(doc(db, 'completed_games', sampleId), sample);
      await fetchGamesDirectly();
    } catch (e) {
      console.error('Error seeding sample game:', e);
      setIsRefreshing(false);
    }
  };

  const filtered = games.filter((g) => {
    const q = filterText.toLowerCase().trim();
    if (!q) return true;
    return (
      g.tableName.toLowerCase().includes(q) ||
      g.winnerName.toLowerCase().includes(q) ||
      g.players.some((p) => p.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Control Bar: Search Filter, View Toggle, Refresh */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by table, champion, or player..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        {/* View Mode & Refresh */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
            {filtered.length} Archived {filtered.length === 1 ? 'Match' : 'Matches'}
          </span>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Table View Format"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10px]">Table</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'cards'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Card Grid Format"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10px]">Cards</span>
            </button>
          </div>

          {/* Refresh directly from Firebase */}
          <button
            onClick={fetchGamesDirectly}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 hover:border-slate-500 transition disabled:opacity-50"
            title="Reload from Firestore completed_games"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-slate-900/50 border border-slate-800 text-center gap-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-xs font-semibold text-slate-400">
            Fetching completed match sessions from Firebase Firestore...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-slate-900/50 border border-slate-800 text-center gap-3 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Trophy className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-200">
            {filterText ? 'No Matches Found Matching Search' : 'No Completed Games In Firestore Yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {filterText
              ? `No archived games match "${filterText}". Try clearing your search.`
              : 'When players cross 1000 points and close a table, or when an AI agent match finishes, archived matches appear here in table format.'}
          </p>
          {!filterText && (
            <button
              onClick={handleSeedSampleMatch}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg hover:scale-102"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Sample Match in Firebase</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* 1. TABLE VIEW FORMAT */
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-950/90 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Match / Table Name</th>
                  <th className="py-3 px-4">Champion</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 hidden md:table-cell">Standings &amp; Players</th>
                  <th className="py-3 px-3 text-center hidden sm:table-cell">Rounds</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Completed Date</th>
                  <th className="py-3 px-3 text-center">AI Flag</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filtered.map((game) => {
                  const dateStr = new Date(game.completedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const isTrained = Boolean(game.isTrainedForGlobalModel);

                  return (
                    <tr
                      key={game.gameId}
                      onClick={() => onSelectGame(game)}
                      className="hover:bg-slate-800/60 transition cursor-pointer group"
                    >
                      {/* Match / Table */}
                      <td className="py-3.5 px-4 font-bold text-slate-100 group-hover:text-amber-300 transition">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate max-w-[160px] sm:max-w-[220px]">
                            {game.tableName}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 sm:hidden">
                          {dateStr}
                        </div>
                      </td>

                      {/* Champion */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-amber-200">
                          <span className="text-sm">👑</span>
                          <span className="truncate max-w-[120px]">{game.winnerName}</span>
                        </div>
                      </td>

                      {/* Winning Score */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                          {game.winnerCumulativeScore} pts
                        </span>
                      </td>

                      {/* Players & Scores */}
                      <td className="py-3.5 px-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {game.players.slice(0, 4).map((p) => (
                            <span
                              key={p.id}
                              className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                p.id === game.winnerId
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                                  : 'bg-slate-950 text-slate-400 border-slate-800'
                              }`}
                              title={`${p.name}: ${p.cumulativeScore} pts (${p.isAgent ? 'Bot' : 'Human'})`}
                            >
                              <span>{p.isAgent ? '🤖' : '👤'}</span>
                              <span className="truncate max-w-[65px]">{p.name.replace(/Agent\s*/, '')}</span>
                              <span className="font-mono text-slate-300">{p.cumulativeScore}</span>
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Rounds count */}
                      <td className="py-3.5 px-3 text-center hidden sm:table-cell font-mono text-slate-400">
                        {game.roundsHistory?.length || 1}
                      </td>

                      {/* Completed Date */}
                      <td className="py-3.5 px-4 hidden lg:table-cell text-slate-400 text-[11px] font-mono">
                        {dateStr}
                      </td>

                      {/* AI Training Status Flag */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 border ${
                            isTrained
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {isTrained ? (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Trained</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-2.5 h-2.5" />
                              <span>Untrained</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectGame(game);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-200 text-[11px] font-bold transition inline-flex items-center gap-1 shadow"
                        >
                          <span>Results</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* 2. CARD GRID FORMAT */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((game) => (
            <div
              key={game.gameId}
              onClick={() => onSelectGame(game)}
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 shadow-xl transition-all flex flex-col justify-between gap-3 cursor-pointer group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                    <Award className="w-3 h-3 text-amber-400" />
                    <span>Finished</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(game.completedAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-sm font-black text-slate-100 group-hover:text-amber-400 transition truncate">
                  {game.tableName}
                </h3>

                <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Champion</span>
                    <div className="font-bold text-amber-300 text-xs flex items-center gap-1">
                      <span>👑 {game.winnerName}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono font-black text-sm text-emerald-400">
                    {game.winnerCumulativeScore} pts
                  </div>
                </div>
              </div>

              <button className="w-full py-2 rounded-xl bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5">
                <span>View Game Results Table</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
