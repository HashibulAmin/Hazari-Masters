import React, { useState, useEffect } from 'react';
import { UserProfile, logoutUser } from '../firebase/authService';
import {
  subscribeToRunningTables,
  subscribeToCompletedGames,
  FirestoreTableSummary,
  CompletedGameRecord,
} from '../firebase/tableService';
import { CreateTableModal } from './CreateTableModal';
import { CompletedGameModal } from './CompletedGameModal';
import { CompletedGamesList } from './CompletedGamesList';
import { AIModelModal } from './AIModelModal';
import { PlayerStatisticsView } from './PlayerStatisticsView';
import { TournamentHistoryView } from './TournamentHistoryView';
import { DailyMissionsCard } from './DailyMissionsCard';
import { DailyChallengesCard } from './DailyChallengesCard';
import { MatchReplayModal } from './MatchReplayModal';
import { GlobalLeaderboard } from './GlobalLeaderboard';
import {
  Trophy,
  Crown,
  Play,
  Users,
  PlusCircle,
  Brain,
  Cpu,
  Eye,
  LogOut,
  ShieldCheck,
  Calendar,
  Layers,
  Award,
  Sparkles,
  Search,
  BarChart3,
  Settings,
} from 'lucide-react';
import { PlayerRankBadge } from './PlayerRankBadge';
import { UserPreferencesModal } from './UserPreferencesModal';

interface DashboardScreenProps {
  currentUser: UserProfile;
  onJoinTable: (tableId: string, tableName: string) => void;
  onInspectTable: (tableId: string, tableName: string) => void;
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  currentUser,
  onJoinTable,
  onInspectTable,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'running' | 'completed' | 'history' | 'stats' | 'leaderboard'>('running');
  const [runningTables, setRunningTables] = useState<FirestoreTableSummary[]>([]);
  const [completedGames, setCompletedGames] = useState<CompletedGameRecord[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCompletedGame, setSelectedCompletedGame] = useState<CompletedGameRecord | null>(null);
  const [replayGame, setReplayGame] = useState<CompletedGameRecord | null>(null);
  const [showGlobalAIModal, setShowGlobalAIModal] = useState(false);
  const [aiModalMode, setAiModalMode] = useState<'global' | 'user'>('global');
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const isAdmin =
    currentUser.email === 'hasibul.amin.hemel@gmail.com' || currentUser.role === 'admin';

  // Compute player total cumulative score across all historical games
  const userCumulativeScore = React.useMemo(() => {
    let total = 0;
    completedGames.forEach((g) => {
      const p = g.players?.find(
        (pl) => pl.id === currentUser.uid || pl.name === currentUser.username
      );
      if (p && typeof p.cumulativeScore === 'number') {
        total += p.cumulativeScore;
      }
    });
    return total;
  }, [completedGames, currentUser]);

  // Compute player win/loss ratio and average hand scores for lobby visualization
  const userMetrics = React.useMemo(() => {
    let played = 0;
    let won = 0;
    let handScoresSum = 0;
    let handScoresCount = 0;

    completedGames.forEach((g) => {
      const p = g.players?.find(
        (pl) => pl.id === currentUser.uid || pl.name === currentUser.username
      );
      if (p) {
        played++;
        const isWinner = g.winnerId === currentUser.uid || g.winnerName === currentUser.username;
        if (isWinner) won++;

        if (p.roundScoresHistory && Array.isArray(p.roundScoresHistory)) {
          p.roundScoresHistory.forEach((s) => {
            if (typeof s === 'number') {
              handScoresSum += s;
              handScoresCount++;
            }
          });
        }
      }
    });

    const lost = Math.max(0, played - won);
    const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
    const avgHandScore = handScoresCount > 0 ? Math.round(handScoresSum / handScoresCount) : 0;

    return {
      played,
      won,
      lost,
      winRate,
      avgHandScore,
      handScoresCount,
    };
  }, [completedGames, currentUser]);

  useEffect(() => {
    const unsubRunning = subscribeToRunningTables((tables) => {
      setRunningTables(tables);
    });
    const unsubCompleted = subscribeToCompletedGames((games) => {
      setCompletedGames(games);
    });
    return () => {
      unsubRunning();
      unsubCompleted();
    };
  }, []);

  const handleCreateAndJoin = (tableId: string, tableName: string) => {
    setShowCreateModal(false);
    onJoinTable(tableId, tableName);
  };

  const filteredRunning = runningTables.filter((t) =>
    t.tableName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredCompleted = completedGames.filter(
    (g) =>
      g.tableName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      g.winnerName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-emerald-950/60 px-4 sm:px-8 py-3 flex items-center justify-between gap-4 shadow-xl sticky top-0 z-30">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-amber-400 p-0.5 shadow-lg flex items-center justify-center font-serif font-black text-slate-950 text-xl">
            H
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-wide text-slate-100 uppercase">
                Hazari Masters
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                1000 PTS
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Tournament Lobby &amp; Match Center</p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Requirement 5: Global AI Pipeline button (ONLY visible to admin) */}
          {isAdmin && (
            <button
              onClick={() => {
                setAiModalMode('global');
                setShowGlobalAIModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950 border border-purple-500/50 hover:bg-purple-900 text-xs font-bold text-purple-300 transition shadow-md shadow-purple-950/50"
              title="Global AI Training Pipeline & Offline Model (Admin Only)"
            >
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="hidden md:inline">Global AI Pipeline</span>
              <span className="text-[9px] bg-purple-500/30 px-1 rounded text-purple-200">Admin</span>
            </button>
          )}

          {/* User Personal Model button (available to each user based on their completed games) */}
          <button
            onClick={() => {
              setAiModalMode('user');
              setShowGlobalAIModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/40 hover:bg-emerald-900 text-xs font-bold text-emerald-300 transition shadow-sm"
            title="My Personal Offline AI Model"
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">My AI Model</span>
          </button>

          {/* User Profile Capsule with Rank Badge next to username */}
          <div className="flex items-center gap-2.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-xs font-black text-emerald-400">
              {currentUser.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>{currentUser.username}</span>
                {/* Visual Rank Badge (Bronze, Silver, Gold, Platinum, Master) based on cumulative score */}
                <PlayerRankBadge score={userCumulativeScore} size="xs" showLabel={true} />
                {isAdmin && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded font-normal">
                    Admin
                  </span>
                )}
                {currentUser.isGuest && (
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded font-normal">
                    Guest
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <span className="text-amber-400 font-bold">{userCumulativeScore.toLocaleString()} pts</span>
                <span>•</span>
                <span className="text-slate-500">{currentUser.email || 'Guest Player'}</span>
              </div>
            </div>
          </div>

          {/* User Preferences & Audio Settings Button */}
          <button
            onClick={() => setShowPreferencesModal(true)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-amber-400 transition"
            title="User Preferences & Audio Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Logout */}
          <button
            onClick={async () => {
              await logoutUser();
              onLogout();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 border border-slate-700 transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
        {/* Banner with Create Table Action */}
        <div className="relative rounded-3xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-amber-950/40 border border-emerald-500/30 p-6 sm:p-8 overflow-hidden shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multiplayer &amp; AI Championship</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
              Ready to Play 1000-Point Hazari?
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Join an open seat at any running table or create your own custom room to play with friends or bots.
            </p>
          </div>

          <div className="relative z-10 shrink-0 flex items-center gap-2.5">
            <button
              onClick={() => setActiveTab('leaderboard')}
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-amber-400 font-bold text-xs uppercase tracking-wider border border-amber-500/40 shadow-lg transition"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Leaderboard</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-amber-400 hover:from-emerald-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl hover:scale-105 active:scale-95 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Game Table</span>
            </button>
          </div>
        </div>

        {/* Daily Card-Arrangement Challenges Feature */}
        <DailyChallengesCard
          userId={currentUser.uid}
          userName={currentUser.username}
          onPlayNow={() => {
            if (runningTables.length > 0) {
              onJoinTable(runningTables[0].tableId, runningTables[0].tableName);
            } else {
              setShowCreateModal(true);
            }
          }}
        />

        {/* Daily Tournament Missions Component */}
        <DailyMissionsCard userId={currentUser.uid} userName={currentUser.username} />

        {/* Player Career Performance & Historical Stats Strip */}
        <div className="p-4 rounded-3xl bg-slate-900/90 border border-emerald-950/80 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* Rank Status */}
            <div className="flex items-center gap-3">
              <div className="text-left">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Lobby Rank</span>
                <div className="mt-0.5 flex items-center gap-2">
                  <PlayerRankBadge score={userCumulativeScore} size="sm" showLabel={true} />
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800 hidden sm:block" />

            {/* Historical Win/Loss Ratio */}
            <div className="text-left">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400" />
                <span>Win / Loss Record</span>
              </span>
              <div className="mt-0.5 flex items-baseline gap-2 font-mono">
                <span className="text-base font-black text-emerald-400">{userMetrics.won}W</span>
                <span className="text-slate-600 font-bold">/</span>
                <span className="text-base font-black text-rose-400">{userMetrics.lost}L</span>
                <span className="text-xs font-bold text-slate-400 ml-1">({userMetrics.winRate}% Win Rate)</span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800 hidden sm:block" />

            {/* Average Hand Score */}
            <div className="text-left">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
                <Award className="w-3 h-3 text-sky-400" />
                <span>Average Hand Score</span>
              </span>
              <div className="mt-0.5 flex items-baseline gap-1.5 font-mono">
                <span className="text-base font-black text-sky-300">{userMetrics.avgHandScore} pts</span>
                <span className="text-[11px] text-slate-500 font-sans">/ 13-card deal</span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800 hidden md:block" />

            {/* Cumulative Career Score */}
            <div className="text-left hidden md:block">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Career Score</span>
              </span>
              <div className="mt-0.5 font-mono text-base font-black text-amber-300">
                {userCumulativeScore.toLocaleString()} pts
              </div>
            </div>
          </div>

          {/* Action button to switch to Recharts Analytics Tab */}
          <button
            onClick={() => setActiveTab('stats')}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition hover:scale-102"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>View Full Recharts Analytics</span>
          </button>
        </div>

        {/* Tab Selector & Search Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'leaderboard'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Global Leaderboard</span>
            </button>

            <button
              onClick={() => setActiveTab('running')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'running'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Running Tables (Open Seats)</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeTab === 'running' ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {runningTables.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'completed'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Completed Games Archive</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeTab === 'completed' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {completedGames.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Tournament History</span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'stats'
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Victory Analytics</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter tables..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-1.5 pl-8 text-xs text-white outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Tab 1: Running Tables (Available Seats) */}
        {activeTab === 'running' && (
          <div>
            {filteredRunning.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-slate-900/50 border border-slate-800 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                  🃏
                </div>
                <h3 className="text-base font-bold text-slate-200">No Running Tables with Open Seats</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  There are currently no active tables with open seats. Start a new table to begin playing with AI agents or invite other online players!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Start New Table</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRunning.map((table) => (
                  <div
                    key={table.tableId}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 shadow-xl transition-all flex flex-col justify-between gap-4 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                            {table.status}
                          </span>
                          {table.humanPlayerCount === 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40">
                              🤖 4 AI Agents
                            </span>
                          )}
                          {table.availableSeatsCount === 0 && table.humanPlayerCount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                              👥 Full Table
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          Round {table.currentRound || 1}
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-slate-100 group-hover:text-emerald-400 transition truncate">
                        {table.tableName}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        Host: {table.createdByName || 'Hazari Host'}
                      </p>

                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <div className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">Open Seats:</span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {table.availableSeatsCount} / 4
                          </span>
                        </div>
                        <div className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">Humans:</span>
                          <span className="font-bold text-sky-400 font-mono">
                            {table.humanPlayerCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dual Actions: Inspect Game or Take a Seat */}
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => onInspectTable(table.tableId, table.tableName)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 shadow ${
                          table.availableSeatsCount === 0
                            ? 'w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/50'
                            : 'flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700 hover:border-slate-500'
                        }`}
                        title="Visit table and see live gameplay"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{table.availableSeatsCount === 0 ? 'Spectate & Inspect Game' : 'Inspect Game'}</span>
                      </button>

                      {table.availableSeatsCount > 0 && (
                        <button
                          onClick={() => onJoinTable(table.tableId, table.tableName)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-1.5 hover:scale-102"
                        >
                          <Play className="w-3.5 h-3.5 fill-slate-950" />
                          <span>Take Seat</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Completed Games Archive */}
        {activeTab === 'completed' && (
          <CompletedGamesList
            searchQuery={searchFilter}
            onSelectGame={(game) => setSelectedCompletedGame(game)}
            onWatchReplay={(game) => setReplayGame(game)}
          />
        )}

        {/* Tab 3: Tournament History View */}
        {activeTab === 'history' && (
          <TournamentHistoryView
            currentUser={currentUser}
            onSelectGame={(game) => setSelectedCompletedGame(game)}
            onWatchReplay={(game) => setReplayGame(game)}
          />
        )}

        {/* Tab 4: Player Statistics Analytics View */}
        {activeTab === 'stats' && (
          <PlayerStatisticsView currentUser={currentUser} />
        )}

        {/* Tab 5: Global Leaderboard View */}
        {activeTab === 'leaderboard' && (
          <GlobalLeaderboard currentUser={currentUser} />
        )}
      </main>

      {/* Modals */}
      <CreateTableModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        currentUser={currentUser}
        onStartTable={handleCreateAndJoin}
      />

      <CompletedGameModal
        game={selectedCompletedGame}
        onClose={() => setSelectedCompletedGame(null)}
        currentUser={currentUser}
        onWatchReplay={(game) => {
          setSelectedCompletedGame(null);
          setReplayGame(game);
        }}
      />

      {/* Global & Personal AI Pipeline Modal */}
      <AIModelModal
        isOpen={showGlobalAIModal}
        onClose={() => setShowGlobalAIModal(false)}
        currentUser={currentUser}
        initialTab={aiModalMode}
      />

      {/* Match Replay Viewer Modal */}
      <MatchReplayModal
        isOpen={Boolean(replayGame)}
        onClose={() => setReplayGame(null)}
        gameRecord={replayGame}
      />

      {/* User Preferences & Audio Settings Modal */}
      <UserPreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        currentUserScore={userCumulativeScore}
        currentUserName={currentUser.username}
      />
    </div>
  );
};
