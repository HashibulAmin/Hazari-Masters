import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  TableChatMessage,
  toggleChatVisibility,
  setChatVisible,
  toggleMutePlayer,
  resetUnreadChatCount,
} from '../store/tableSlice';
import {
  MessageSquare,
  Send,
  X,
  Minimize2,
  Volume2,
  VolumeX,
  UserX,
  UserCheck,
  Bot,
  User,
  Sparkles,
  ShieldAlert,
  ChevronDown,
  Smile,
  Settings,
} from 'lucide-react';

interface TableChatProps {
  className?: string;
}

const PRESET_MESSAGES = [
  'Good Luck everyone!',
  'Well played!',
  'Nice arrangement!',
  'GG! Great match!',
  'Watch out for that Troy!',
  'Hurry up please! ⏳',
  '🔥',
  '🃏',
  '👏',
  '😎',
];

export const TableChat: React.FC<TableChatProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { chatMessages, unreadChatCount, isChatVisible, mutedPlayerIds, tableState, userSeatIndex } =
    useAppSelector((state) => state.table);
  const { userId, userName } = useAppSelector((state) => state.network);

  const [inputText, setInputText] = useState('');
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isChatVisible) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      dispatch(resetUnreadChatCount());
    }
  }, [chatMessages, isChatVisible, dispatch]);

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text) return;

    dispatch({
      type: 'socket/sendChatMessage',
      payload: { text },
    });

    setInputText('');
    setShowPresets(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter messages based on muted player IDs
  const visibleMessages = chatMessages.filter((msg) => {
    if (!msg.senderId) return true;
    const isMuted =
      mutedPlayerIds.includes(msg.senderId.toLowerCase()) ||
      mutedPlayerIds.includes(msg.senderName.toLowerCase());
    return !isMuted;
  });

  const hiddenCount = chatMessages.length - visibleMessages.length;

  // List of active table players for the Mute menu
  const tablePlayers = tableState?.players || [];

  return (
    <>
      {/* Floating Toggle Button (Visible when chat is closed or minimized) */}
      {!isChatVisible && (
        <button
          onClick={() => dispatch(setChatVisible(true))}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-2xl transition transform hover:scale-105 active:scale-95 border border-emerald-400/50"
          title="Open Table Chat"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 fill-slate-950" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] animate-bounce shadow">
                {unreadChatCount}
              </span>
            )}
          </div>
          <span>Table Chat</span>
          {unreadChatCount > 0 && (
            <span className="bg-slate-950/20 px-1.5 py-0.5 rounded-full text-[10px] font-mono">
              {unreadChatCount} new
            </span>
          )}
        </button>
      )}

      {/* Main Chat Panel (Visible when opened) */}
      {isChatVisible && (
        <div
          className={`fixed bottom-4 right-4 z-50 w-80 sm:w-96 max-w-[calc(100vw-2rem)] h-[460px] max-h-[80vh] flex flex-col rounded-3xl bg-slate-950/95 backdrop-blur-md border border-emerald-500/30 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 ${className}`}
        >
          {/* Chat Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/60 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-100">Table Chat</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                  {tableState?.tableName || 'Live Hazari Game'}
                </p>
              </div>
            </div>

            {/* Actions: Mute Menu & Close */}
            <div className="flex items-center gap-1">
              {/* Mute Manager Toggle */}
              <button
                onClick={() => setShowMuteMenu(!showMuteMenu)}
                className={`p-2 rounded-xl transition text-xs font-bold flex items-center gap-1 border ${
                  mutedPlayerIds.length > 0 || showMuteMenu
                    ? 'bg-rose-950/60 border-rose-800/60 text-rose-300'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700'
                }`}
                title="Mute or Unmute Table Players"
              >
                {mutedPlayerIds.length > 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
                {mutedPlayerIds.length > 0 && (
                  <span className="text-[10px] font-mono">{mutedPlayerIds.length}</span>
                )}
              </button>

              {/* Close/Minimize */}
              <button
                onClick={() => dispatch(setChatVisible(false))}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"
                title="Minimize Chat"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Mute Manager Dropdown Menu */}
          {showMuteMenu && (
            <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2 text-xs shrink-0 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <UserX className="w-3.5 h-3.5 text-rose-400" />
                  Mute Specific Players
                </span>
                <span className="text-[10px] text-slate-400">
                  {mutedPlayerIds.length} muted
                </span>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {tablePlayers.map((player) => {
                  const isSelf =
                    player.id === userId ||
                    (userSeatIndex !== null && player.seatIndex === userSeatIndex);
                  const isMuted =
                    mutedPlayerIds.includes(player.id.toLowerCase()) ||
                    mutedPlayerIds.includes(player.name.toLowerCase());

                  if (isSelf) return null; // Can't mute yourself

                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-5 h-5 rounded-lg bg-slate-800 flex items-center justify-center text-[10px]">
                          {player.isAgent ? '🤖' : '👤'}
                        </span>
                        <div className="truncate">
                          <span className="font-bold text-slate-200 text-xs block truncate">
                            {player.name}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            Seat {player.seatIndex + 1} {player.isAgent ? '• AI' : '• Player'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => dispatch(toggleMutePlayer(player.id))}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border ${
                          isMuted
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {isMuted ? (
                          <>
                            <VolumeX className="w-3 h-3 text-rose-400" />
                            <span>Unmute</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 text-slate-400" />
                            <span>Mute</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Muted Messages Hidden Notice Banner */}
          {hiddenCount > 0 && !showMuteMenu && (
            <div className="px-3 py-1 bg-rose-950/40 border-b border-rose-900/30 flex items-center justify-between text-[10px] text-rose-300 shrink-0">
              <span className="flex items-center gap-1">
                <VolumeX className="w-3 h-3 text-rose-400" />
                {hiddenCount} message{hiddenCount === 1 ? '' : 's'} from muted players hidden
              </span>
              <button
                onClick={() => setShowMuteMenu(true)}
                className="font-bold underline hover:text-rose-200"
              >
                Manage
              </button>
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
            {visibleMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 gap-2">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-lg">
                  💬
                </div>
                <p className="text-xs font-semibold text-slate-400">Welcome to Table Chat!</p>
                <p className="text-[10px] text-slate-500 max-w-[200px]">
                  Say hello, celebrate great arrangements, or send quick reactions during the 1000-point championship.
                </p>
              </div>
            ) : (
              visibleMessages.map((msg) => {
                const isMe = msg.senderId === userId || msg.senderName === userName;
                const isMuted =
                  mutedPlayerIds.includes(msg.senderId?.toLowerCase()) ||
                  mutedPlayerIds.includes(msg.senderName?.toLowerCase());

                const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                if (msg.isSystem) {
                  return (
                    <div key={msg.id} className="text-center my-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-900/80 text-slate-400 text-[10px] border border-slate-800">
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                  >
                    {/* Sender Label */}
                    <div className="flex items-center gap-1 mb-0.5 text-[10px] text-slate-400">
                      <span className="font-bold text-slate-300">
                        {isMe ? 'You' : msg.senderName}
                      </span>
                      {msg.seatIndex !== null && (
                        <span className="px-1 rounded bg-slate-900 text-slate-500 text-[9px] border border-slate-800">
                          S{msg.seatIndex + 1}
                        </span>
                      )}
                      {msg.isAgent && (
                        <span className="px-1 rounded bg-purple-950 text-purple-400 text-[9px] border border-purple-800">
                          AI
                        </span>
                      )}
                      <span className="text-slate-600 font-mono text-[9px]">{timeStr}</span>

                      {/* Quick Mute on Hover for non-self messages */}
                      {!isMe && (
                        <button
                          onClick={() => dispatch(toggleMutePlayer(msg.senderId || msg.senderName))}
                          className="opacity-0 group-hover:opacity-100 transition p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 ml-1"
                          title="Mute this player"
                        >
                          <VolumeX className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs break-words shadow-md ${
                        isMe
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-slate-950 font-medium rounded-tr-sm'
                          : msg.isAgent
                          ? 'bg-purple-950/70 border border-purple-800/60 text-purple-200 rounded-tl-sm'
                          : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Preset Reactions Drawer */}
          {showPresets && (
            <div className="p-2 bg-slate-900/95 border-t border-slate-800 flex flex-wrap gap-1.5 shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-150 max-h-32 overflow-y-auto">
              {PRESET_MESSAGES.map((preset, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => handleSendMessage(preset)}
                  className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-emerald-300 transition"
                >
                  {preset}
                </button>
              ))}
            </div>
          )}

          {/* Input & Controls Bar */}
          <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-1.5 shrink-0">
            {/* Quick preset reactions toggle */}
            <button
              onClick={() => setShowPresets(!showPresets)}
              className={`p-2 rounded-xl transition border ${
                showPresets
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
              title="Quick Presets & Emotes"
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={280}
              placeholder="Message table players..."
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600"
            />

            {/* Send Button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-slate-950 font-bold transition shadow"
              title="Send Message"
            >
              <Send className="w-4 h-4 fill-slate-950" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
