import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../firebase/authService';
import { CompletedGameRecord, fetchAllCompletedGamesFromFirebase } from '../firebase/tableService';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Trophy,
  Award,
  TrendingUp,
  Percent,
  Gamepad2,
  Zap,
  Target,
  RefreshCw,
  User,
  Users,
  Shield,
  Clock,
  Sparkles,
  Download,
  Bot,
} from 'lucide-react';

interface PlayerStatisticsViewProps {
  currentUser: UserProfile;
}

export const PlayerStatisticsView: React.FC<PlayerStatisticsViewProps> = ({ currentUser }) => {
  const [games, setGames] = useState<CompletedGameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterScope, setFilterScope] = useState<'me' | 'all'>('me');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStatsData = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchAllCompletedGamesFromFirebase();
      setGames(data);
    } catch (err) {
      console.warn('Failed to fetch statistics data from Firestore:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatsData();
  }, []);

  // Filter games based on scope
  const relevantGames = useMemo(() => {
    if (filterScope === 'all') return games;
    return games.filter((g) =>
      g.players && g.players.some((p) => p.id === currentUser.uid || p.name === currentUser.username)
    );
  }, [games, filterScope, currentUser]);

  // Derived metrics
  const stats = useMemo(() => {
    let totalPlayed = 0;
    let totalWon = 0;
    let totalScore = 0;
    let highestScore = 0;
    const scores: number[] = [];

    const scoreBuckets = {
      '< 300': 0,
      '300 - 599': 0,
      '600 - 799': 0,
      '800 - 999': 0,
      '1000+ (Win)': 0,
    };

    const timelineData: { match: string; score: number; winnerScore: number; date: string }[] = [];

    // Track strategies
    const strategyWins: Record<string, { wins: number; total: number }> = {
      optimal_ev: { wins: 0, total: 0 },
      aggressive: { wins: 0, total: 0 },
      balanced: { wins: 0, total: 0 },
      defensive: { wins: 0, total: 0 },
    };

    // Sort chronologically for timeline
    const sortedChronological = [...relevantGames].sort((a, b) => a.completedAt - b.completedAt);

    let totalLoss = 0;
    let humanWins = 0;
    let humanLosses = 0;
    let agentWins = 0;
    let agentLosses = 0;

    sortedChronological.forEach((game, idx) => {
      if (filterScope === 'all') {
        // Requirement 3: Global tournament analytics counts wins/losses based on both real users and agents.
        // If an agent loses, that counts as a loss!
        game.players.forEach((p) => {
          totalPlayed += 1;
          const isWinner = p.id === game.winnerId || p.name === game.winnerName;
          if (isWinner) {
            totalWon += 1;
            if (p.isAgent) agentWins += 1;
            else humanWins += 1;
          } else {
            totalLoss += 1;
            if (p.isAgent) agentLosses += 1;
            else humanLosses += 1;
          }
        });
      } else {
        // User personal stats
        totalPlayed += 1;
        const isWinner =
          game.winnerId === currentUser.uid || game.winnerName === currentUser.username;

        if (isWinner) {
          totalWon += 1;
        } else {
          totalLoss += 1;
        }
      }

      // Find user player record if scoped to user
      const userPlayer = game.players.find(
        (p) => p.id === currentUser.uid || p.name === currentUser.username
      );
      const score = filterScope === 'me' && userPlayer ? userPlayer.cumulativeScore : game.winnerCumulativeScore;

      totalScore += score;
      if (score > highestScore) highestScore = score;
      scores.push(score);

      // Bucket distribution
      if (score < 300) scoreBuckets['< 300'] += 1;
      else if (score < 600) scoreBuckets['300 - 599'] += 1;
      else if (score < 800) scoreBuckets['600 - 799'] += 1;
      else if (score < 1000) scoreBuckets['800 - 999'] += 1;
      else scoreBuckets['1000+ (Win)'] += 1;

      // Timeline entry (last 15 matches)
      timelineData.push({
        match: `M#${idx + 1}`,
        score,
        winnerScore: game.winnerCumulativeScore,
        date: new Date(game.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      });

      // Sample strategies
      if (game.trainingSamples) {
        game.trainingSamples.forEach((s) => {
          const strat = s.winningStrategy || 'optimal_ev';
          if (strategyWins[strat]) {
            strategyWins[strat].total += 1;
            if (s.score >= 1000) strategyWins[strat].wins += 1;
          }
        });
      }
    });

    const winLossData = [
      { name: 'Wins', value: totalWon, color: '#10b981' }, // emerald-500
      { name: 'Losses', value: totalLoss, color: '#f43f5e' }, // rose-500
    ];

    const distributionData = Object.entries(scoreBuckets).map(([range, count]) => ({
      range,
      count,
    }));

    const strategyChartData = Object.entries(strategyWins).map(([strat, val]) => ({
      strategy: strat.replace('_', ' ').toUpperCase(),
      winRate: val.total > 0 ? Math.round((val.wins / val.total) * 100) : 0,
      totalUses: val.total,
    }));

    const winRatePct = totalPlayed > 0 ? Math.round((totalWon / totalPlayed) * 100) : 0;
    const avgScore = totalPlayed > 0 ? Math.round(totalScore / totalPlayed) : 0;

    return {
      totalPlayed,
      totalWon,
      totalLoss,
      humanWins,
      humanLosses,
      agentWins,
      agentLosses,
      winRatePct,
      avgScore,
      highestScore,
      totalScore,
      winLossData,
      distributionData,
      timelineData: timelineData.slice(-15),
      strategyChartData,
      strategyDetails: strategyWins,
    };
  }, [relevantGames, filterScope, currentUser]);

  // Requirement 1: Export current user's strategy performance data as a JSON file
  const handleExportJSON = () => {
    const metrics = stats;
    const exportData = {
      title: 'Hazari Masters – Strategy Performance & Telemetry Export',
      exportedAt: new Date().toISOString(),
      timestamp: Date.now(),
      scope: filterScope,
      user: {
        uid: currentUser.uid,
        username: currentUser.username,
        email: currentUser.email,
        role: currentUser.role,
      },
      summary: {
        totalMatchesCount: relevantGames.length,
        totalGameOutcomesEvaluated: metrics.totalPlayed,
        totalWins: metrics.totalWon,
        totalLosses: metrics.totalLoss,
        winRatePct: `${metrics.winRatePct}%`,
        highestScore: metrics.highestScore,
        averageScore: metrics.avgScore,
        globalBreakdown:
          filterScope === 'all'
            ? {
                humanWins: metrics.humanWins,
                humanLosses: metrics.humanLosses,
                agentWins: metrics.agentWins,
                agentLosses: metrics.agentLosses,
              }
            : undefined,
      },
      strategyPerformance: metrics.strategyDetails,
      scoreDistribution: metrics.distributionData,
      matchTimeline: metrics.timelineData,
      rawMatchHistory: relevantGames.map((g) => ({
        gameId: g.gameId,
        tableName: g.tableName,
        completedAt: g.completedAt,
        completedDate: new Date(g.completedAt).toISOString(),
        winnerName: g.winnerName,
        winnerCumulativeScore: g.winnerCumulativeScore,
        userWon: g.winnerId === currentUser.uid || g.winnerName === currentUser.username,
        players: g.players,
        roundsHistory: g.roundsHistory || [],
        trainingSamples: g.trainingSamples || [],
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hazari_strategy_performance_${currentUser.username || 'user'}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const COLORS = ['#10b981', '#64748b'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Controls: Scope toggle & Refresh */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <span>Victory Analytics &amp; Strategy Performance</span>
            </h2>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              Firestore Live
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time score distributions, win/loss ratios, and match history aggregated from Firebase.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Scope Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setFilterScope('me')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterScope === 'me'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>My Stats ({currentUser.username})</span>
            </button>

            <button
              onClick={() => setFilterScope('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterScope === 'all'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Tournament Global</span>
            </button>
          </div>

          {/* Requirement 1: Export Strategy Performance Data as JSON */}
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition hover:scale-102"
            title="Export current user's strategy performance data as JSON file for external analysis"
          >
            <Download className="w-3.5 h-3.5 text-emerald-200" />
            <span className="hidden sm:inline">Export Strategy JSON</span>
            <span className="sm:hidden">Export</span>
          </button>

          <button
            onClick={loadStatsData}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            title="Refresh statistics from Firestore"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Human vs Agent Breakdown Banner */}
      {filterScope === 'all' && stats.totalPlayed > 0 && (
        <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-slate-200">
              Global Outcome Tracking: Real Users &amp; AI Agents
            </span>
            <span className="text-[10px] text-purple-300/80">
              (Each non-winning seat counts as a loss)
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Humans:</span>
              <span className="text-emerald-400 font-bold">{stats.humanWins}W</span>
              <span className="text-slate-500">/</span>
              <span className="text-rose-400 font-bold">{stats.humanLosses}L</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400">Agents:</span>
              <span className="text-emerald-400 font-bold">{stats.agentWins}W</span>
              <span className="text-slate-500">/</span>
              <span className="text-rose-400 font-bold">{stats.agentLosses}L</span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-3xl bg-slate-900/50 border border-slate-800 text-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs text-slate-400 font-semibold">Aggregating player performance from Firestore...</p>
        </div>
      ) : stats.totalPlayed === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-3xl bg-slate-900/50 border border-slate-800 text-center gap-3">
          <Trophy className="w-12 h-12 text-slate-600" />
          <h3 className="text-base font-bold text-slate-200">No Match Sessions Recorded Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {filterScope === 'me'
              ? 'Complete a match table to see your personal win/loss ratios and score distributions.'
              : 'Complete a match table to populate tournament-wide statistics.'}
          </p>
        </div>
      ) : (
        <>
          {/* Key KPI Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Gamepad2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Games Played</span>
              </span>
              <div className="mt-1 font-mono text-2xl font-black text-slate-100">{stats.totalPlayed}</div>
              <span className="text-[10px] text-slate-500">Completed Sessions</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Victories</span>
              </span>
              <div className="mt-1 font-mono text-2xl font-black text-amber-300">{stats.totalWon}</div>
              <span className="text-[10px] text-emerald-400 font-bold">{stats.winRatePct}% Win Rate</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-rose-400" />
                <span>Losses</span>
              </span>
              <div className="mt-1 font-mono text-2xl font-black text-rose-400">{stats.totalLoss}</div>
              <span className="text-[10px] text-slate-500">Defeats</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-emerald-400" />
                <span>Win Ratio</span>
              </span>
              <div className="mt-1 font-mono text-2xl font-black text-emerald-400">{stats.winRatePct}%</div>
              <span className="text-[10px] text-slate-500">{stats.totalWon}W / {stats.totalLoss}L</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Avg Match Score</span>
              </span>
              <div className="mt-1 font-mono text-2xl font-black text-amber-400">{stats.avgScore}</div>
              <span className="text-[10px] text-slate-500">pts / session</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-purple-400" />
                <span>Peak Score</span>
              </span>
              <div className="mt-1 font-mono text-2xl font-black text-purple-300">{stats.highestScore}</div>
              <span className="text-[10px] text-slate-500">1000 pt threshold</span>
            </div>
          </div>

          {/* Charts Row 1: Win/Loss Ratio Pie & Score Distribution Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Win/Loss Donut Chart */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-emerald-400" />
                    <span>Win / Loss Breakdown</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Proportional outcome of finished Hazari match sessions</p>
                </div>
                <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                  {stats.winRatePct}% Win Rate
                </span>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.winLossData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.winLossData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val) => <span className="text-slate-300 text-xs font-bold">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-center">
                <div className="p-2 rounded-xl bg-slate-950">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase">Victories</span>
                  <div className="font-mono text-lg font-black text-emerald-300">{stats.totalWon}</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-950">
                  <span className="text-[10px] text-rose-400 font-bold uppercase">Defeats</span>
                  <div className="font-mono text-lg font-black text-rose-400">{stats.totalLoss}</div>
                </div>
              </div>
            </div>

            {/* Score Distribution Histogram */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Score Distribution (Point Brackets)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Frequency of final scores across points milestones</p>
                </div>
                <span className="text-[11px] font-mono text-slate-400">Target: 1000 pts</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.distributionData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="range" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                      formatter={(value: any) => [`${value} matches`, 'Frequency']}
                    />
                    <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Highest concentration:</span>
                <span className="font-bold text-amber-300">
                  {stats.distributionData.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), {
                    range: '1000+',
                    count: 0,
                  }).range}{' '}
                  pts
                </span>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Performance Trend Timeline (Area Chart) */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sky-400" />
                  <span>Match-by-Match Score Trend</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Point trajectory across the last {stats.timelineData.length} completed sessions
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Score
                </span>
                <span className="flex items-center gap-1.5 text-amber-400 font-mono">
                  --- 1000 pt Target
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.timelineData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="match" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 'dataMax + 100']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#020617',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => [`${value} points`, 'Points']}
                  />
                  <ReferenceLine
                    y={1000}
                    label={{ value: '1000 Wins', fill: '#f59e0b', fontSize: 10, position: 'top' }}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#scoreGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
