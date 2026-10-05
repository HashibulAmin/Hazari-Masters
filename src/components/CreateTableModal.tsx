import React, { useState, useEffect } from 'react';
import { UserProfile } from '../firebase/authService';
import { sendGameInvite, searchUsers } from '../firebase/tableService';
import { Sparkles, Users, UserPlus, Play, Clock, X, Search, Check, AlertCircle } from 'lucide-react';

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onStartTable: (tableId: string, tableName: string) => void;
}

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onStartTable,
}) => {
  const [tableName, setTableName] = useState(`${currentUser.username}'s Hazari Table`);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ uid: string; username: string; email: string | null }[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<{ uid: string; username: string; email: string | null }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isWaitingForInvites, setIsWaitingForInvites] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [createdTableId, setCreatedTableId] = useState<string | null>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchUsers(searchQuery, currentUser.uid);
        setSearchResults(res || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUser.uid]);

  // 1-minute countdown timer when waiting for invited online players
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isWaitingForInvites && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else if (isWaitingForInvites && countdown === 0) {
      // 1 minute expired! Auto-start table with agents
      handleProceedToGame();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isWaitingForInvites, countdown]);

  if (!isOpen) return null;

  const handleAddInvite = (user: { uid: string; username: string; email: string | null }) => {
    if (invitedUsers.length >= 3) return; // Hazari table max 4 players (host + up to 3 guests)
    if (!invitedUsers.some((u) => u.uid === user.uid)) {
      setInvitedUsers([...invitedUsers, user]);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleRemoveInvite = (uid: string) => {
    setInvitedUsers(invitedUsers.filter((u) => u.uid !== uid));
  };

  const handleCreate = async () => {
    const tId = `table_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const finalName = tableName.trim() || `${currentUser.username}'s Hazari Table`;
    setCreatedTableId(tId);

    // If online players invited, send Firestore invites and start 60s countdown
    if (invitedUsers.length > 0) {
      setIsWaitingForInvites(true);
      setCountdown(60);
      for (const target of invitedUsers) {
        await sendGameInvite(
          tId,
          finalName,
          currentUser.uid,
          currentUser.username,
          target.uid,
          target.email || ''
        );
      }
    } else {
      // Immediate launch solo with AI agents
      onStartTable(tId, finalName);
    }
  };

  const handleProceedToGame = () => {
    if (createdTableId) {
      const finalName = tableName.trim() || `${currentUser.username}'s Hazari Table`;
      onStartTable(createdTableId, finalName);
    }
  };

  return (
    <div
      onClick={isWaitingForInvites ? undefined : onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
              🎴
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Create New Game Table</h2>
              <p className="text-[11px] text-slate-400">Play with AI bots or invite online friends to compete</p>
            </div>
          </div>
          {!isWaitingForInvites && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {isWaitingForInvites ? (
            /* 1-Minute Waiting Screen */
            <div className="flex flex-col items-center text-center p-4 space-y-4">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                <span className="font-mono text-2xl font-black text-amber-300">{countdown}s</span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-100">Waiting for Invited Players...</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Invites sent to {invitedUsers.map((u) => u.username).join(', ')}. If they reject or 60 seconds elapse, the game will automatically launch with AI agents filling remaining seats!
                </p>
              </div>

              <div className="w-full space-y-2">
                {invitedUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <span className="font-semibold text-slate-200">{u.username}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" /> Pending response...
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleProceedToGame}
                className="w-full mt-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Start Now with Available Seats &amp; Agents</span>
              </button>
            </div>
          ) : (
            /* Create Form */
            <>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Table Name
                </label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="e.g. Royal Hazari Room"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition"
                />
              </div>

              {/* Invite Players Search */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Invite Online Friends (Optional)
                  </label>
                  <span className="text-[10px] text-slate-500">{invitedUsers.length}/3 invited</span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by username or email..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 pl-9 text-xs text-white outline-none transition"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="mt-1 max-h-36 overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 divide-y divide-slate-800/60 shadow-xl">
                    {searchResults.map((user) => (
                      <div
                        key={user.uid}
                        onClick={() => handleAddInvite(user)}
                        className="p-2.5 hover:bg-slate-900 cursor-pointer flex items-center justify-between text-xs transition"
                      >
                        <div>
                          <span className="font-bold text-slate-200">{user.username}</span>
                          {user.email && <span className="text-[10px] text-slate-500 ml-2">({user.email})</span>}
                        </div>
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                          <UserPlus className="w-3 h-3" /> Invite
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invited Users Chips */}
                {invitedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {invitedUsers.map((u) => (
                      <span
                        key={u.uid}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 font-medium"
                      >
                        <span>{u.username}</span>
                        <button
                          onClick={() => handleRemoveInvite(u.uid)}
                          className="hover:text-white transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                Any seat not filled by human players will automatically be assigned to Hazari AI Agents with distinct persona strategies.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isWaitingForInvites && (
          <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>{invitedUsers.length > 0 ? 'Send Invites & Launch' : 'Start Table (Solo + AI)'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
