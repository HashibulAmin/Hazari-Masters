import React, { useEffect, useState } from 'react';
import { subscribeToIncomingInvites, respondToInvite, GameInviteRecord } from '../firebase/tableService';
import { UserProfile } from '../firebase/authService';
import { Mail, Check, X, Clock } from 'lucide-react';

interface InviteNotificationToastProps {
  currentUser: UserProfile;
  onAcceptInvite: (tableId: string, tableName: string) => void;
}

export const InviteNotificationToast: React.FC<InviteNotificationToastProps> = ({
  currentUser,
  onAcceptInvite,
}) => {
  const [invites, setInvites] = useState<GameInviteRecord[]>([]);

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;
    const unsubscribe = subscribeToIncomingInvites(currentUser.uid, (activeInvites) => {
      setInvites(activeInvites);
    });
    return () => unsubscribe();
  }, [currentUser]);

  if (invites.length === 0) return null;

  const currentInvite = invites[0];

  const handleAccept = async () => {
    await respondToInvite(currentInvite.inviteId, 'ACCEPTED');
    onAcceptInvite(currentInvite.tableId, currentInvite.tableName);
  };

  const handleReject = async () => {
    await respondToInvite(currentInvite.inviteId, 'REJECTED');
    setInvites((prev) => prev.filter((i) => i.inviteId !== currentInvite.inviteId));
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-bounce-short">
      <div className="p-4 rounded-2xl bg-slate-900 border-2 border-emerald-500/80 shadow-2xl backdrop-blur-xl text-slate-100 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
            <Mail className="w-4 h-4" />
            <span>Table Invitation!</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400 animate-spin" /> Active
          </span>
        </div>

        <div>
          <p className="text-xs text-slate-200">
            <strong className="text-amber-300">{currentInvite.fromUserName}</strong> invited you to join{' '}
            <strong className="text-emerald-400">{currentInvite.tableName}</strong>!
          </p>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleAccept}
            className="flex-1 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow transition flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Accept &amp; Join</span>
          </button>
          <button
            onClick={handleReject}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Decline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
