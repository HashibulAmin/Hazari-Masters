import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile } from '../firebase/authService';
import {
  CompletedGameRecord,
  fetchAllCompletedGamesFromFirebase,
  computeLeaderboardStats,
  LeaderboardPlayerStats,
  subscribeToCompletedGames,
} from '../firebase/tableService';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Trophy,
  Crown,
  Medal,
  Award,
  TrendingUp,
  User,
  Bot,
  Search,
  RefreshCw,
  Download,
  Filter,
  Zap,
  Swords,
  Shield,
  Star,
  Users,
  Target,
  ChevronDown,
  ChevronUp,
  X,
  Flame,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowUpDown,
  BarChart3,
} from 'lucide-react';

interface GlobalLeaderboardProps {
  currentUser: UserProfile;
}

export type RankingCriterion =
  | 'score'
  | 'winrate'
  | 'human_winrate'
  | 'ai_winrate'
  | 'tournament_index';

export const GlobalLeaderboard: React.FC<GlobalLeaderboardProps> = ({ currentUser }) => {
  const [games, setGames] = useState<CompletedGameRecord[]>([]);
  const [knownUsers, setKnownUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rankingCriterion, setRankingCriterion] = useState<RankingCriterion>('score');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [playerTypeFilter, setPlayerTypeFilter] = useState<'all' | 'human' | 'agent'>('all');
  const [minGamesFilter, setMinGamesFilter] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardPlayerStats | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);
  const currentUserRowRef = useRef<HTMLTableRowElement>(null);

  // Load games and known user profiles
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [fetchedGames, usersSnap] = await Promise.all([
        fetchAllCompletedGamesFromFirebase(),
        getDocs(query(collection(db, 'users'), limit(50))).catch(() => null),
      ]);

      setGames(fetchedGames);

      if (usersSnap && !usersSnap.empty) {
        const uList: UserProfile[] = [];
        usersSnap.forEach((docSnap) => {
          uList.push(docSnap.data() as UserProfile);
        });
        setKnownUsers(uList);
      }
    } catch (err) {
      console.warn('Failed to load leaderboard data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToCompletedGames((updatedGames) => {
      if (Array.isArray(updatedGames) && updatedGames.length > 0) {
        setGames(updatedGames);
      }
    });
    return () => unsub();
  }, []);

  // Compute stats across all games and known users
  const rawLeaderboard = useMemo(() => {
    return computeLeaderboardStats(games, knownUsers);
  }, [games, knownUsers]);

  // Apply filters and sorting
  const rankedPlayers = useMemo(() => {
    let list = [...rawLeaderboard];

    // Filter by player type
    if (playerTypeFilter === 'human') {
      list = list.filter((p) => !p.isAgent);
    } else if (playerTypeFilter === 'agent') {
      list = list.filter((p) => p.isAgent);
    }

    // Filter by minimum games played
    if (minGamesFilter > 1) {
      list = list.filter((p) => p.totalGames >= minGamesFilter);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.playerName.toLowerCase().includes(q) ||
          p.playerId.toLowerCase().includes(q)
      );
    }

    // Sort based on selected criterion
    list.sort((a, b) => {
      let comparison = 0;
      switch (rankingCriterion) {
        case 'score':
          // Sort primarily by total cumulative score, then overall win %
          if (b.totalCumulativeScore !== a.totalCumulativeScore) {
            comparison = b.totalCumulativeScore - a.totalCumulativeScore;
          } else {
            comparison = b.overallWinRate - a.overallWinRate;
          }
          break;
        case 'winrate':
          // Sort primarily by overall win %, then by total cumulative score
          if (b.overallWinRate !== a.overallWinRate) {
            comparison = b.overallWinRate - a.overallWinRate;
          } else {
            comparison = b.totalCumulativeScore - a.totalCumulativeScore;
          }
          break;
        case 'human_winrate':
          // Sort primarily by win rate vs human opponents, then total score
          if (b.winRateVsHumans !== a.winRateVsHumans) {
            comparison = b.winRateVsHumans - a.winRateVsHumans;
          } else {
            comparison = b.totalCumulativeScore - a.totalCumulativeScore;
          }
          break;
        case 'ai_winrate':
          // Sort primarily by win rate vs AI opponents, then total score
          if (b.winRateVsAI !== a.winRateVsAI) {
            comparison = b.winRateVsAI - a.winRateVsAI;
          } else {
            comparison = b.totalCumulativeScore - a.totalCumulativeScore;
          }
          break;
        case 'tournament_index':
        default:
          if (b.tournamentIndex !== a.tournamentIndex) {
            comparison = b.tournamentIndex - a.tournamentIndex;
          } else {
            comparison = b.totalCumulativeScore - a.totalCumulativeScore;
          }
          break;
      }
      return sortDirection === 'desc' ? comparison : -comparison;
    });

    return list;
  }, [rawLeaderboard, playerTypeFilter, minGamesFilter, searchQuery, rankingCriterion, sortDirection]);

  // Current user's standing in the leaderboard
  const currentUserStanding = useMemo(() => {
    const userUid = currentUser.uid?.toLowerCase();
    const username = currentUser.username?.toLowerCase();
    const index = rankedPlayers.findIndex(
      (p) =>
        p.playerId.toLowerCase() === userUid ||
        p.playerName.toLowerCase() === username
    );

    if (index === -1) {
      // Find in raw list if filtered out
      const rawIndex = rawLeaderboard.findIndex(
        (p) =>
          p.playerId.toLowerCase() === userUid ||
          p.playerName.toLowerCase() === username
      );
      if (rawIndex !== -1) {
        return {
          rank: rawIndex + 1,
          stats: rawLeaderboard[rawIndex],
          isFilteredOut: true,
        };
      }
      return null;
    }

    return {
      rank: index + 1,
      stats: rankedPlayers[index],
      isFilteredOut: false,
    };
  }, [rankedPlayers, rawLeaderboard, currentUser]);

  // Max score for relative progress bar calculation
  const maxScore = useMemo(() => {
    if (rankedPlayers.length === 0) return 1000;
    return Math.max(...rankedPlayers.map((p) => p.totalCumulativeScore), 1000);
  }, [rankedPlayers]);

  // Key tournament statistics for top banner
  const tournamentMetrics = useMemo(() => {
    const totalCompetitors = rawLeaderboard.length;
    const humanCount = rawLeaderboard.filter((p) => !p.isAgent).length;
    const agentCount = rawLeaderboard.filter((p) => p.isAgent).length;

    // Top scorer
    const topScorer = [...rawLeaderboard].sort(
      (a, b) => b.totalCumulativeScore - a.totalCumulativeScore
    )[0];

    // Top win rate (minimum 1 game)
    const topWinRate = [...rawLeaderboard]
      .filter((p) => p.totalGames >= 1)
      .sort((a, b) => b.overallWinRate - a.overallWinRate)[0];

    // Top vs Humans (minimum 1 game vs humans)
    const topVsHumans = [...rawLeaderboard]
      .filter((p) => p.gamesVsHumans >= 1)
      .sort((a, b) => b.winRateVsHumans - a.winRateVsHumans || b.winsVsHumans - a.winsVsHumans)[0];

    // Top vs AI (minimum 1 game vs AI)
    const topVsAI = [...rawLeaderboard]
      .filter((p) => p.gamesVsAI >= 1)
      .sort((a, b) => b.winRateVsAI - a.winRateVsAI || b.winsVsAI - a.winsVsAI)[0];

    return {
      totalCompetitors,
      humanCount,
      agentCount,
      totalGames: games.length,
      topScorer,
      topWinRate,
      topVsHumans,
      topVsAI,
    };
  }, [rawLeaderboard, games]);

  // Jump to user row
  const scrollToUser = () => {
    if (currentUserRowRef.current) {
      currentUserRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      currentUserRowRef.current.classList.add('ring-2', 'ring-amber-400', 'bg-amber-500/20');
      setTimeout(() => {
        currentUserRowRef.current?.classList.remove('ring-2', 'ring-amber-400', 'bg-amber-500/20');
      }, 2500);
    }
  };

  // Export Leaderboard data
  const exportLeaderboard = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const dataStr =
        'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(rankedPlayers, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `hazari_leaderboard_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      const headers = [
        'Rank',
        'Player ID',
        'Player Name',
        'Type',
        'Total Games',
        'Total Score',
        'Total Wins',
        'Overall Win %',
        'Games vs Humans',
        'Wins vs Humans',
        'Win % vs Humans',
        'Games vs AI',
        'Wins vs AI',
        'Win % vs AI',
        'Avg Score',
        'Highest Match Score',
      ];

      const rows = rankedPlayers.map((p, idx) => [
        idx + 1,
        `"${p.playerId}"`,
        `"${p.playerName}"`,
        p.isAgent ? 'AI Agent' : 'Human Player',
        p.totalGames,
        p.totalCumulativeScore,
        p.totalWins,
        `${p.overallWinRate}%`,
        p.gamesVsHumans,
        p.winsVsHumans,
        `${p.winRateVsHumans}%`,
        p.gamesVsAI,
        p.winsVsAI,
        `${p.winRateVsAI}%`,
        p.averageScore,
        p.highestMatchScore,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `hazari_leaderboard_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  // Top 3 Podium players
  const topThree = useMemo(() => {
    return rankedPlayers.slice(0, 3);
  }, [rankedPlayers]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-900/50 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                Global Rankings
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1">
                <Swords className="w-3.5 h-3.5" />
                Human & AI Arena
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100 font-serif tracking-tight flex items-center gap-3">
              Championship Global Leaderboard
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Official player rankings based on total cumulative score and win percentage against both human players and AI neural agents.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition shadow"
              title="Refresh Leaderboard Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => exportLeaderboard('csv')}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 text-xs font-bold border border-emerald-800/60 transition shadow"
                title="Export Leaderboard as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => exportLeaderboard('json')}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition shadow"
                title="Export Leaderboard as JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Top 4 KPI metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Top Total Scorer</p>
              <p className="text-sm font-black text-slate-100 truncate max-w-[130px]">
                {tournamentMetrics.topScorer ? tournamentMetrics.topScorer.playerName : '—'}
              </p>
              <p className="text-[10px] text-amber-400 font-mono font-bold">
                {tournamentMetrics.topScorer ? `${tournamentMetrics.topScorer.totalCumulativeScore.toLocaleString()} pts` : '—'}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Highest Win Rate</p>
              <p className="text-sm font-black text-slate-100 truncate max-w-[130px]">
                {tournamentMetrics.topWinRate ? tournamentMetrics.topWinRate.playerName : '—'}
              </p>
              <p className="text-[10px] text-emerald-400 font-mono font-bold">
                {tournamentMetrics.topWinRate ? `${tournamentMetrics.topWinRate.overallWinRate}% (${tournamentMetrics.topWinRate.totalWins}W)` : '—'}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Top vs Humans</p>
              <p className="text-sm font-black text-slate-100 truncate max-w-[130px]">
                {tournamentMetrics.topVsHumans ? tournamentMetrics.topVsHumans.playerName : '—'}
              </p>
              <p className="text-[10px] text-sky-400 font-mono font-bold">
                {tournamentMetrics.topVsHumans ? `${tournamentMetrics.topVsHumans.winRateVsHumans}% (${tournamentMetrics.topVsHumans.winsVsHumans}W)` : '—'}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Top vs AI</p>
              <p className="text-sm font-black text-slate-100 truncate max-w-[130px]">
                {tournamentMetrics.topVsAI ? tournamentMetrics.topVsAI.playerName : '—'}
              </p>
              <p className="text-[10px] text-purple-400 font-mono font-bold">
                {tournamentMetrics.topVsAI ? `${tournamentMetrics.topVsAI.winRateVsAI}% (${tournamentMetrics.topVsAI.winsVsAI}W)` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* User Standing Banner */}
      {currentUserStanding && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black font-serif text-lg flex items-center justify-center shadow-lg border border-amber-300">
              #{currentUserStanding.rank}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Your Standing</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {currentUserStanding.stats.playerName}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-100">
                Rank #{currentUserStanding.rank} of {rankedPlayers.length} ranked competitors
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs w-full sm:w-auto justify-between sm:justify-end">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Total Score</span>
              <span className="font-mono font-black text-amber-400">
                {currentUserStanding.stats.totalCumulativeScore.toLocaleString()} pts
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Overall Win %</span>
              <span className="font-mono font-black text-emerald-400">
                {currentUserStanding.stats.overallWinRate}%
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">vs Humans</span>
              <span className="font-mono font-black text-sky-400">
                {currentUserStanding.stats.winRateVsHumans}%
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">vs AI</span>
              <span className="font-mono font-black text-purple-400">
                {currentUserStanding.stats.winRateVsAI}%
              </span>
            </div>

            <button
              onClick={scrollToUser}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition flex items-center gap-1.5"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Locate Me</span>
            </button>
          </div>
        </div>
      )}

      {/* Top 3 Podium Showcase (shown if at least 3 players exist) */}
      {topThree.length >= 3 && !searchQuery && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              Championship Podium Leaders
            </h3>
            <span className="text-xs text-slate-500">
              Top 3 based on current criterion:{' '}
              <span className="text-amber-400 font-bold">
                {rankingCriterion === 'score'
                  ? 'Total Cumulative Score'
                  : rankingCriterion === 'winrate'
                  ? 'Overall Win %'
                  : rankingCriterion === 'human_winrate'
                  ? 'Win % vs Humans'
                  : rankingCriterion === 'ai_winrate'
                  ? 'Win % vs AI'
                  : 'Championship Index'}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* 2nd Place (Silver) */}
            {topThree[1] && (
              <div
                onClick={() => setSelectedPlayer(topThree[1])}
                className="order-2 md:order-1 p-5 rounded-2xl bg-gradient-to-t from-slate-950 via-slate-900 to-slate-800/80 border border-slate-700/80 hover:border-slate-500 transition shadow-lg cursor-pointer transform hover:-translate-y-1 relative group"
              >
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-700/80 border border-slate-500 flex items-center justify-center font-black text-slate-200 text-xs shadow">
                  #2
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-700 border border-slate-500 flex items-center justify-center text-xl shadow">
                    {topThree[1].isAgent ? '🤖' : '👤'}
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-100 truncate block">
                        {topThree[1].playerName}
                      </span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${topThree[1].isAgent ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-sky-950 text-sky-300 border border-sky-800'}`}>
                      {topThree[1].isAgent ? 'AI Agent' : 'Human Player'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs pt-2 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Score:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {topThree[1].totalCumulativeScore.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Overall Win Rate:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {topThree[1].overallWinRate}% ({topThree[1].totalWins}W / {topThree[1].totalGames}G)
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">vs Humans / vs AI:</span>
                    <span className="font-mono text-slate-300">
                      <span className="text-sky-400 font-bold">{topThree[1].winRateVsHumans}%</span> / <span className="text-purple-400 font-bold">{topThree[1].winRateVsAI}%</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 1st Place (Gold Champion) */}
            {topThree[0] && (
              <div
                onClick={() => setSelectedPlayer(topThree[0])}
                className="order-1 md:order-2 p-6 rounded-2xl bg-gradient-to-t from-slate-950 via-slate-900 to-amber-950/40 border-2 border-amber-500/70 hover:border-amber-400 transition shadow-2xl cursor-pointer transform hover:-translate-y-1 relative group md:-translate-y-2"
              >
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 fill-slate-950" />
                  Champion #1
                </div>

                <div className="flex items-center gap-3.5 mb-4 pt-1">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 border-2 border-amber-200 flex items-center justify-center text-2xl shadow-xl">
                    {topThree[0].isAgent ? '🤖' : '👑'}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-black text-base text-slate-100 truncate">
                      {topThree[0].playerName}
                    </h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-0.5 ${topThree[0].isAgent ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-sky-950 text-sky-300 border border-sky-800'}`}>
                      {topThree[0].isAgent ? 'AI Agent' : 'Human Grandmaster'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs pt-3 border-t border-amber-500/30">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Score:</span>
                    <span className="font-mono font-black text-amber-400 text-sm">
                      {topThree[0].totalCumulativeScore.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Overall Win Rate:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {topThree[0].overallWinRate}% ({topThree[0].totalWins} Wins)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="p-1.5 rounded-lg bg-sky-950/50 border border-sky-900/60 text-center">
                      <span className="text-[10px] text-slate-400 block">vs Humans</span>
                      <span className="font-mono font-bold text-sky-300">{topThree[0].winRateVsHumans}%</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-purple-950/50 border border-purple-900/60 text-center">
                      <span className="text-[10px] text-slate-400 block">vs AI</span>
                      <span className="font-mono font-bold text-purple-300">{topThree[0].winRateVsAI}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3rd Place (Bronze) */}
            {topThree[2] && (
              <div
                onClick={() => setSelectedPlayer(topThree[2])}
                className="order-3 p-5 rounded-2xl bg-gradient-to-t from-slate-950 via-slate-900 to-amber-950/20 border border-amber-800/50 hover:border-amber-700 transition shadow-lg cursor-pointer transform hover:-translate-y-1 relative group"
              >
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-amber-900/60 border border-amber-700 flex items-center justify-center font-black text-amber-300 text-xs shadow">
                  #3
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-900/40 border border-amber-700/60 flex items-center justify-center text-xl shadow">
                    {topThree[2].isAgent ? '🤖' : '👤'}
                  </div>
                  <div className="overflow-hidden">
                    <span className="font-bold text-sm text-slate-100 truncate block">
                      {topThree[2].playerName}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${topThree[2].isAgent ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-sky-950 text-sky-300 border border-sky-800'}`}>
                      {topThree[2].isAgent ? 'AI Agent' : 'Human Player'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs pt-2 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Score:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {topThree[2].totalCumulativeScore.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Overall Win Rate:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {topThree[2].overallWinRate}% ({topThree[2].totalWins}W / {topThree[2].totalGames}G)
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">vs Humans / vs AI:</span>
                    <span className="font-mono text-slate-300">
                      <span className="text-sky-400 font-bold">{topThree[2].winRateVsHumans}%</span> / <span className="text-purple-400 font-bold">{topThree[2].winRateVsAI}%</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Control Toolbar: Ranking Criterion, Filter by Type, Min Games, Search */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        {/* Row 1: Ranking Criterion Pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-bold text-slate-400 mr-1.5 flex items-center gap-1 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Rank By:
            </span>

            <button
              onClick={() => {
                setRankingCriterion('score');
                setSortDirection('desc');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                rankingCriterion === 'score'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Total Score</span>
            </button>

            <button
              onClick={() => {
                setRankingCriterion('winrate');
                setSortDirection('desc');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                rankingCriterion === 'winrate'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Overall Win %</span>
            </button>

            <button
              onClick={() => {
                setRankingCriterion('human_winrate');
                setSortDirection('desc');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                rankingCriterion === 'human_winrate'
                  ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Win % vs Humans</span>
            </button>

            <button
              onClick={() => {
                setRankingCriterion('ai_winrate');
                setSortDirection('desc');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                rankingCriterion === 'ai_winrate'
                  ? 'bg-purple-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Win % vs AI</span>
            </button>

            <button
              onClick={() => {
                setRankingCriterion('tournament_index');
                setSortDirection('desc');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                rankingCriterion === 'tournament_index'
                  ? 'bg-indigo-600 text-white shadow-md font-black'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Championship Index</span>
            </button>
          </div>

          {/* Sort direction toggle */}
          <button
            onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className="self-end md:self-auto px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition"
            title="Toggle sort direction"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
            <span>{sortDirection === 'desc' ? 'Highest First' : 'Lowest First'}</span>
          </button>
        </div>

        {/* Row 2: Player Type Filter + Min Games + Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {/* Player Type */}
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-950 border border-slate-800">
              <button
                onClick={() => setPlayerTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  playerTypeFilter === 'all'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Players ({rawLeaderboard.length})
              </button>
              <button
                onClick={() => setPlayerTypeFilter('human')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  playerTypeFilter === 'human'
                    ? 'bg-sky-950 text-sky-300 border border-sky-800/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3 h-3" />
                <span>Humans</span>
              </button>
              <button
                onClick={() => setPlayerTypeFilter('agent')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  playerTypeFilter === 'agent'
                    ? 'bg-purple-950 text-purple-300 border border-purple-800/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bot className="w-3 h-3" />
                <span>AI Agents</span>
              </button>
            </div>

            {/* Min Matches filter */}
            <div className="flex items-center gap-1 text-xs text-slate-400 pl-1">
              <span className="hidden lg:inline text-[11px]">Min matches:</span>
              {[1, 2, 5].map((count) => (
                <button
                  key={count}
                  onClick={() => setMinGamesFilter(count)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition ${
                    minGamesFilter === count
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {count === 1 ? 'All' : `${count}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player name..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-1.5 pl-8 text-xs text-white outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div ref={tableRef} className="rounded-3xl bg-slate-900/70 border border-slate-800 overflow-hidden shadow-2xl">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
            <p className="text-xs font-bold">Compiling global leaderboard rankings from completed matches...</p>
          </div>
        ) : rankedPlayers.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
            <Trophy className="w-12 h-12 text-slate-600" />
            <h3 className="text-base font-bold text-slate-200">No Players Found</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {searchQuery
                ? `No players matched "${searchQuery}". Try modifying your search or filters.`
                : 'Complete game tables to 1000 points with AI agents or online users to populate the global leaderboard.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                  <th className="py-3.5 pl-5 pr-2 w-16 text-center">Rank</th>
                  <th className="py-3.5 px-3 min-w-[180px]">Player & Type</th>
                  <th className="py-3.5 px-3 min-w-[160px]">
                    <div className="flex items-center gap-1 text-amber-400">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>Total Cumulative Score</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 min-w-[140px]">
                    <div className="flex items-center gap-1 text-emerald-400">
                      <Target className="w-3.5 h-3.5" />
                      <span>Overall Win %</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 min-w-[150px]">
                    <div className="flex items-center gap-1 text-sky-400">
                      <User className="w-3.5 h-3.5" />
                      <span>vs Human Opponents</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 min-w-[150px]">
                    <div className="flex items-center gap-1 text-purple-400">
                      <Bot className="w-3.5 h-3.5" />
                      <span>vs AI Opponents</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 min-w-[100px] text-right">Avg / Best</th>
                  <th className="py-3.5 pr-5 pl-2 text-center w-24">Form / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {rankedPlayers.map((player, index) => {
                  const rank = index + 1;
                  const isCurrentUser =
                    player.playerId.toLowerCase() === currentUser.uid?.toLowerCase() ||
                    player.playerName.toLowerCase() === currentUser.username?.toLowerCase();

                  // Progress percentage for total score relative to top
                  const scorePercent = Math.min(100, Math.round((player.totalCumulativeScore / maxScore) * 100));

                  return (
                    <tr
                      key={player.playerId}
                      ref={isCurrentUser ? currentUserRowRef : undefined}
                      onClick={() => setSelectedPlayer(player)}
                      className={`group transition cursor-pointer hover:bg-slate-800/50 ${
                        isCurrentUser
                          ? 'bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-l-amber-400'
                          : rank <= 3
                          ? 'bg-slate-900/40'
                          : ''
                      }`}
                    >
                      {/* Rank Column */}
                      <td className="py-3.5 pl-5 pr-2 text-center">
                        {rank === 1 ? (
                          <div className="w-7 h-7 mx-auto rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black flex items-center justify-center shadow">
                            <Crown className="w-4 h-4 fill-slate-950" />
                          </div>
                        ) : rank === 2 ? (
                          <div className="w-7 h-7 mx-auto rounded-xl bg-slate-400 text-slate-950 font-black flex items-center justify-center shadow">
                            <Medal className="w-4 h-4 fill-slate-950" />
                          </div>
                        ) : rank === 3 ? (
                          <div className="w-7 h-7 mx-auto rounded-xl bg-amber-700 text-slate-100 font-black flex items-center justify-center shadow">
                            <Medal className="w-4 h-4 fill-slate-100" />
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-slate-400">#{rank}</span>
                        )}
                      </td>

                      {/* Player & Type */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                              player.isAgent
                                ? 'bg-purple-950/70 border-purple-800 text-purple-300'
                                : 'bg-sky-950/70 border-sky-800 text-sky-300'
                            }`}
                          >
                            {player.isAgent ? '🤖' : '👤'}
                          </div>
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-100 truncate">
                                {player.playerName}
                              </span>
                              {isCurrentUser && (
                                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                              <span className={`px-1.5 py-0.2 rounded font-semibold ${player.isAgent ? 'text-purple-400' : 'text-sky-400'}`}>
                                {player.isAgent ? 'AI Agent' : 'Human'}
                              </span>
                              <span>•</span>
                              <span>{player.totalGames} {player.totalGames === 1 ? 'match' : 'matches'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total Cumulative Score */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <div className="flex items-baseline justify-between">
                            <span className="font-mono font-black text-amber-400 text-sm">
                              {player.totalCumulativeScore.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">pts</span>
                          </div>
                          {/* Visual progress bar */}
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                            <div
                              className="bg-gradient-to-r from-amber-600 to-amber-400 h-full rounded-full transition-all duration-500"
                              style={{ width: `${scorePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Overall Win % */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-emerald-400 text-sm">
                              {player.overallWinRate}%
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950 font-mono text-slate-400 border border-slate-800">
                              {player.totalWins}W / {player.totalLosses}L
                            </span>
                          </div>
                          {/* Win rate progress */}
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${player.overallWinRate}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* vs Human Opponents */}
                      <td className="py-3.5 px-3">
                        {player.gamesVsHumans > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-sky-400">
                                {player.winRateVsHumans}%
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                ({player.winsVsHumans}/{player.gamesVsHumans} matches)
                              </span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                              <div
                                className="bg-sky-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${player.winRateVsHumans}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px] italic">No human matches</span>
                        )}
                      </td>

                      {/* vs AI Opponents */}
                      <td className="py-3.5 px-3">
                        {player.gamesVsAI > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-purple-400">
                                {player.winRateVsAI}%
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                ({player.winsVsAI}/{player.gamesVsAI} matches)
                              </span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                              <div
                                className="bg-purple-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${player.winRateVsAI}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px] italic">No AI matches</span>
                        )}
                      </td>

                      {/* Avg / Best */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="font-mono text-[11px]">
                          <span className="text-slate-200 block font-bold">{player.averageScore} avg</span>
                          <span className="text-slate-500 text-[10px]">Best: {player.highestMatchScore}</span>
                        </div>
                      </td>

                      {/* Form / Action */}
                      <td className="py-3.5 pr-5 pl-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {player.recentOutcomes.slice(-4).map((out, oIdx) => (
                            <span
                              key={oIdx}
                              className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${
                                out === 'W'
                                  ? 'bg-emerald-500 text-slate-950 font-black'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {out}
                            </span>
                          ))}
                        </div>
                        <span className="text-[9px] text-amber-400/80 group-hover:underline block mt-1">
                          Inspect
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Player Detail Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border shadow-lg ${
                    selectedPlayer.isAgent
                      ? 'bg-purple-950/80 border-purple-700 text-purple-300'
                      : 'bg-sky-950/80 border-sky-700 text-sky-300'
                  }`}
                >
                  {selectedPlayer.isAgent ? '🤖' : '👤'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-100">{selectedPlayer.playerName}</h3>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        selectedPlayer.isAgent
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : 'bg-sky-950 text-sky-300 border border-sky-800'
                      }`}
                    >
                      {selectedPlayer.isAgent ? 'AI Agent' : 'Human Player'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {selectedPlayer.playerId}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPlayer(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Performance Stats Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Score</span>
                <span className="text-base font-black font-mono text-amber-400">
                  {selectedPlayer.totalCumulativeScore.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 block">cumulative pts</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Overall Win Rate</span>
                <span className="text-base font-black font-mono text-emerald-400">
                  {selectedPlayer.overallWinRate}%
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {selectedPlayer.totalWins}W / {selectedPlayer.totalLosses}L
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">vs Humans</span>
                <span className="text-base font-black font-mono text-sky-400">
                  {selectedPlayer.winRateVsHumans}%
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {selectedPlayer.winsVsHumans}W / {selectedPlayer.gamesVsHumans}G
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">vs AI Agents</span>
                <span className="text-base font-black font-mono text-purple-400">
                  {selectedPlayer.winRateVsAI}%
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {selectedPlayer.winsVsAI}W / {selectedPlayer.gamesVsAI}G
                </span>
              </div>
            </div>

            {/* In-depth Matchup Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-amber-400" />
                Head-to-Head Opponent Breakdown
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Human Opponent Breakdown Card */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-sky-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      Human Competitors
                    </span>
                    <span className="text-xs font-mono font-black text-sky-400">
                      {selectedPlayer.winRateVsHumans}% Win Rate
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-sky-500 h-full rounded-full"
                      style={{ width: `${selectedPlayer.winRateVsHumans}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                    <span>Matches with Humans: <strong className="text-slate-200">{selectedPlayer.gamesVsHumans}</strong></span>
                    <span>Wins: <strong className="text-emerald-400">{selectedPlayer.winsVsHumans}</strong></span>
                    <span>Losses to Humans: <strong className="text-rose-400">{selectedPlayer.lossesVsHumans}</strong></span>
                  </div>
                </div>

                {/* AI Opponent Breakdown Card */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-purple-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      AI Neural Agents
                    </span>
                    <span className="text-xs font-mono font-black text-purple-400">
                      {selectedPlayer.winRateVsAI}% Win Rate
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-purple-500 h-full rounded-full"
                      style={{ width: `${selectedPlayer.winRateVsAI}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                    <span>Matches with AI: <strong className="text-slate-200">{selectedPlayer.gamesVsAI}</strong></span>
                    <span>Wins: <strong className="text-emerald-400">{selectedPlayer.winsVsAI}</strong></span>
                    <span>Losses to AI: <strong className="text-rose-400">{selectedPlayer.lossesVsAI}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Match Form */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Recent Tournament Finishes
              </h4>
              <div className="flex items-center gap-2">
                {selectedPlayer.recentFinishes.length === 0 ? (
                  <span className="text-xs text-slate-500 italic">No recent match finishes</span>
                ) : (
                  selectedPlayer.recentFinishes.map((pos, idx) => (
                    <div
                      key={idx}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1 border ${
                        pos === 1
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : pos === 2
                          ? 'bg-slate-700/50 text-slate-300 border-slate-600'
                          : pos === 3
                          ? 'bg-amber-900/30 text-amber-500 border-amber-800'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      <span>Pos #{pos}</span>
                      <span className="text-[10px] text-slate-400">
                        ({selectedPlayer.recentOutcomes[idx] === 'W' ? 'Won' : 'Lost'})
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedPlayer(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition shadow"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
