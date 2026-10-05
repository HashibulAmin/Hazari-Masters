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
import { AIModelModal } from './AIModelModal';
import {
  Trophy,
  Play,
  Users,
  PlusCircle,
  Brain,
  LogOut,
  ShieldCheck,
  Calendar,
  Layers,
  Award,
  Sparkles,
  Search,
} from 'lucide-react';

interface DashboardScreenProps {
  currentUser: UserProfile;
  onJoinTable: (tableId: string, tableName: string) => void;
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  currentUser,
  onJoinTable,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'running' | 'completed'>('running');
  const [runningTables, setRunningTables] = useState<FirestoreTableSummary[]>([]);
  const [completedGames, setCompletedGames] = useState<CompletedGameRecord[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCompletedGame, setSelectedCompletedGame] = useState<CompletedGameRecord | null>(null);
  const [showGlobalAIModal, setShowGlobalAIModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const isAdmin =
    currentUser.email === 'hasibul.amin.hemel@gmail.com' || currentUser.role === 'admin';

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
              onClick={() => setShowGlobalAIModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950 border border-purple-500/50 hover:bg-purple-900 text-xs font-bold text-purple-300 transition shadow-md shadow-purple-950/50"
              title="Global AI Training Pipeline & Offline Model (Admin Only)"
            >
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="hidden md:inline">Global AI Pipeline</span>
              <span className="text-[9px] bg-purple-500/30 px-1 rounded text-purple-200">Admin</span>
            </button>
          )}

          {/* User Profile Capsule */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-400">
              {currentUser.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <span>{currentUser.username}</span>
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
              <span className="text-[10px] text-slate-500">{currentUser.email || 'Guest Player'}</span>
            </div>
          </div>

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

          <div className="relative z-10 shrink-0">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-amber-400 hover:from-emerald-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl hover:scale-105 active:scale-95 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Game Table</span>
            </button>
          </div>
        </div>

        {/* Tab Selector & Search Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
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
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                          {table.status}
                        </span>
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

                    <button
                      onClick={() => onJoinTable(table.tableId, table.tableName)}
                      className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-2 group-hover:scale-102"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>Take Seat &amp; Play</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Completed Games Archive */}
        {activeTab === 'completed' && (
          <div>
            {filteredCompleted.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-slate-900/50 border border-slate-800 text-center gap-3">
                <Trophy className="w-12 h-12 text-slate-600" />
                <h3 className="text-base font-bold text-slate-200">No Completed Games Archived Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Matches that reach 1000 points and are closed will be archived here with complete round-by-round points breakdown.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCompleted.map((game) => (
                  <div
                    key={game.gameId}
                    onClick={() => setSelectedCompletedGame(game)}
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
      />

      {/* Global AI Pipeline Modal (Admin Only) */}
      <AIModelModal
        isOpen={showGlobalAIModal}
        onClose={() => setShowGlobalAIModal(false)}
      />
    </div>
  );
};
