import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../firebase/authService';
import { CompletedGameRecord, fetchAllCompletedGamesFromFirebase } from '../firebase/tableService';
import {
  Trophy,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Layers,
  Crown,
  Search,
  RefreshCw,
  Film,
  ChevronRight,
  Shield,
  Zap,
  Target,
  Sparkles,
} from 'lucide-react';

interface TournamentHistoryViewProps {
  currentUser: UserProfile;
  onSelectGame?: (game: CompletedGameRecord) => void;
  onWatchReplay?: (game: CompletedGameRecord) => void;
}

interface EnrichedMatchRecord {
  game: CompletedGameRecord;
  finishPosition: number; // 1, 2, 3, or 4
  ratingMovement: number; // e.g. +35, +12, -8, -25
  ratingAfter: number;
  userScore: number;
  winnerScore: number;
  winnerName: string;
  isUserWinner: boolean;
  roundsCount: number;
}

export const TournamentHistoryView: React.FC<TournamentHistoryViewProps> = ({
  currentUser,
  onSelectGame,
  onWatchReplay,
}) => {
  const [games, setGames] = useState<CompletedGameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState<'all' | '1st' | 'podium'>('all');

  const loadHistory = async () => {
    setIsRefreshing(true);
    try {
      const allGames = await fetchAllCompletedGamesFromFirebase();
      setGames(allGames);
    } catch (err) {
      console.warn('Error loading tournament history:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Compute ranking movements and finish positions
  const userMatches: EnrichedMatchRecord[] = useMemo(() => {
    // Filter games where currentUser participated
    const participating = games.filter(
      (g) =>
        g.players &&
        g.players.some(
          (p) =>
            p.id === currentUser.uid ||
            p.name.toLowerCase() === currentUser.username.toLowerCase()
        )
    );

    const chronological = [...participating].sort((a, b) => a.completedAt - b.completedAt);

    let currentRating = 1000; // Base Elo / Tournament Points
    const enriched: EnrichedMatchRecord[] = [];

    chronological.forEach((game) => {
      // Sort 4 players by score descending to get finish positions
      const sortedPlayers = [...game.players].sort(
        (a, b) => b.cumulativeScore - a.cumulativeScore
      );

      const userIndex = sortedPlayers.findIndex(
        (p) =>
          p.id === currentUser.uid ||
          p.name.toLowerCase() === currentUser.username.toLowerCase()
      );

      const finishPosition = userIndex !== -1 ? userIndex + 1 : 4;
      const userPlayer = sortedPlayers[userIndex];
      const userScore = userPlayer ? userPlayer.cumulativeScore : 0;
      const isUserWinner =
        finishPosition === 1 ||
        game.winnerId === currentUser.uid ||
        game.winnerName === currentUser.username;

      // Ranking movement system:
      // 1st: +35 RP, 2nd: +12 RP, 3rd: -8 RP, 4th: -25 RP
      let movement = 0;
      if (finishPosition === 1) movement = 35;
      else if (finishPosition === 2) movement = 12;
      else if (finishPosition === 3) movement = -8;
      else movement = -25;

      currentRating = Math.max(100, currentRating + movement);

      enriched.push({
        game,
        finishPosition,
        ratingMovement: movement,
        ratingAfter: currentRating,
        userScore,
        winnerScore: game.winnerCumulativeScore,
        winnerName: game.winnerName,
        isUserWinner,
        roundsCount: game.roundsHistory?.length || 1,
      });
    });

    // Return newest first for display
    return enriched.reverse();
  }, [games, currentUser]);

  // Overall career summary
  const summary = useMemo(() => {
    const total = userMatches.length;
    const wins = userMatches.filter((m) => m.finishPosition === 1).length;
    const podiums = userMatches.filter((m) => m.finishPosition <= 2).length;
    const currentRating = userMatches[0]?.ratingAfter || 1000;
    const highestRating =
      userMatches.length > 0
        ? Math.max(...userMatches.map((m) => m.ratingAfter))
        : 1000;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const totalPoints = userMatches.reduce((acc, m) => acc + m.userScore, 0);

    let tier = 'Gold Competitor';
    let tierColor = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    if (currentRating >= 1300) {
      tier = 'Grandmaster';
      tierColor = 'text-purple-300 border-purple-500/40 bg-purple-500/20';
    } else if (currentRating >= 1150) {
      tier = 'Diamond Master';
      tierColor = 'text-cyan-300 border-cyan-500/40 bg-cyan-500/20';
    } else if (currentRating >= 1050) {
      tier = 'Platinum Contender';
      tierColor = 'text-emerald-300 border-emerald-500/40 bg-emerald-500/20';
    } else if (currentRating < 950) {
      tier = 'Silver Challenger';
      tierColor = 'text-slate-300 border-slate-500/40 bg-slate-500/20';
    }

    return {
      total,
      wins,
      podiums,
      currentRating,
      highestRating,
      winRate,
      totalPoints,
      tier,
      tierColor,
    };
  }, [userMatches]);

  // Filtered list
  const filteredMatches = useMemo(() => {
    return userMatches.filter((m) => {
      const matchesSearch =
        m.game.tableName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        m.winnerName.toLowerCase().includes(searchFilter.toLowerCase());

      if (!matchesSearch) return false;
      if (positionFilter === '1st') return m.finishPosition === 1;
      if (positionFilter === 'podium') return m.finishPosition <= 2;
      return true;
    });
  }, [userMatches, searchFilter, positionFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Career Banner & Rating Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-100">
                  {currentUser.username} – Tournament History
                </h2>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${summary.tierColor}`}>
                  {summary.tier}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official Hazari 1000-Point tournament record, final scores, and ranking movements.
              </p>
            </div>
          </div>
        </div>

        {/* Rating & Fast Stats Tiles */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Tournament RP</span>
            <div className="text-lg font-mono font-black text-amber-400 flex items-center justify-center gap-1">
              <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{summary.currentRating}</span>
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">1st Place Wins</span>
            <span className="text-lg font-mono font-black text-emerald-400">
              {summary.wins} <span className="text-xs text-slate-500">({summary.winRate}%)</span>
            </span>
          </div>

          <div className="px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Matches Played</span>
            <span className="text-lg font-mono font-black text-slate-200">
              {summary.total}
            </span>
          </div>

          <button
            onClick={loadHistory}
            disabled={isRefreshing}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            title="Refresh Tournament History"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setPositionFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              positionFilter === 'all'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Matches ({userMatches.length})
          </button>

          <button
            onClick={() => setPositionFilter('1st')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              positionFilter === '1st'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            🥇 Champions ({summary.wins})
          </button>

          <button
            onClick={() => setPositionFilter('podium')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              positionFilter === 'podium'
                ? 'bg-sky-500 text-slate-950 shadow'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Podiums ({summary.podiums})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search tournament..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-1.5 pl-8 text-xs text-white outline-none"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Matches List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-xs font-semibold">Loading tournament history from Firestore...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="p-16 rounded-3xl bg-slate-900/60 border border-slate-800 text-center flex flex-col items-center justify-center gap-3">
          <Trophy className="w-12 h-12 text-slate-600" />
          <h3 className="text-base font-bold text-slate-200">No Tournament Matches Found</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {searchFilter
              ? `No matches match "${searchFilter}". Try clearing your search filter.`
              : 'Join or create a game table and play to 1000 points. Your match finishes, final scores, and ranking movements will be cataloged here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMatches.map(({ game, finishPosition, ratingMovement, ratingAfter, userScore, roundsCount }) => {
            const dateStr = new Date(game.completedAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            const isWin = finishPosition === 1;

            return (
              <div
                key={game.gameId}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isWin
                    ? 'bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-950 border-amber-500/40 shadow-lg'
                    : finishPosition === 2
                    ? 'bg-slate-900/90 border-slate-700'
                    : 'bg-slate-950/90 border-slate-800'
                }`}
              >
                {/* Left: Finish Rank & Movement */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 ${
                      isWin
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md'
                        : finishPosition === 2
                        ? 'bg-slate-800 text-slate-200 border border-slate-700'
                        : finishPosition === 3
                        ? 'bg-amber-900/20 text-amber-600 border border-amber-900/40'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    <span className="text-base leading-none">
                      {finishPosition === 1 ? '🥇' : finishPosition === 2 ? '🥈' : finishPosition === 3 ? '🥉' : '4th'}
                    </span>
                    <span className="text-[9px] font-mono mt-0.5">
                      {finishPosition === 1 ? '1st' : finishPosition === 2 ? '2nd' : finishPosition === 3 ? '3rd' : '4th'}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-100 truncate max-w-xs">
                        {game.tableName}
                      </h4>
                      {isWin && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5" /> Winner
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{dateStr}</span>
                      <span>•</span>
                      <span>{roundsCount} Round{roundsCount > 1 ? 's' : ''} Fought</span>
                    </p>
                  </div>
                </div>

                {/* Middle: Standings of all 4 players */}
                <div className="w-full md:w-auto flex-1 max-w-md">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    Final Table Scores
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                    {game.players.map((p, pIdx) => {
                      const isMe =
                        p.id === currentUser.uid ||
                        p.name.toLowerCase() === currentUser.username.toLowerCase();
                      const isChampion = p.id === game.winnerId || p.name === game.winnerName;

                      return (
                        <div
                          key={p.id || pIdx}
                          className={`p-1.5 rounded-lg border flex flex-col justify-between ${
                            isMe
                              ? 'bg-amber-500/10 border-amber-500/40'
                              : isChampion
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          <span className={`text-[10px] truncate font-bold ${isMe ? 'text-amber-300' : 'text-slate-300'}`}>
                            {p.isAgent ? '🤖 ' : '👤 '}{p.name.replace(/Agent\s*/, '')}
                          </span>
                          <span className="font-mono font-black text-[11px] text-slate-200">
                            {p.cumulativeScore} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Ranking Movement & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  {/* Rating Movement Indicator */}
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">RP Movement</span>
                    <div className="flex items-center gap-1 font-mono font-black text-xs">
                      {ratingMovement > 0 ? (
                        <span className="text-emerald-400 flex items-center">
                          <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                          +{ratingMovement} RP
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center">
                          <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                          {ratingMovement} RP
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({ratingAfter})
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {onWatchReplay && (
                      <button
                        onClick={() => onWatchReplay(game)}
                        className="px-2.5 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition flex items-center gap-1 shadow"
                        title="Watch card play sequence in Replay viewer"
                      >
                        <Film className="w-3.5 h-3.5 text-purple-400" />
                        <span className="hidden sm:inline">Replay</span>
                      </button>
                    )}

                    {onSelectGame && (
                      <button
                        onClick={() => onSelectGame(game)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-bold transition flex items-center gap-1 shadow"
                        title="Inspect Game Results Breakdown"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
