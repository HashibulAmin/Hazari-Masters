import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { handleFirestoreError, OperationType } from './errors';
import { TableState } from '../core/hazari/types';

export interface FirestoreTableSummary {
  tableId: string;
  tableName: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
  status: string;
  targetScore: number;
  currentRound: number;
  humanPlayerCount: number;
  availableSeatsCount: number;
  playerNames: string[];
  isCompleted: boolean;
  closedBy: string[];
}

export interface CompletedGameRecord {
  gameId: string;
  tableId: string;
  tableName: string;
  completedAt: number;
  winnerId: string;
  winnerName: string;
  winnerCumulativeScore: number;
  roundsHistory: {
    roundNumber: number;
    winnerName: string;
    pointsAwarded: number;
    playerScores: { playerName: string; roundScore: number; cumulativeScore: number }[];
  }[];
  players: { id: string; name: string; isAgent: boolean; cumulativeScore: number }[];
  closedBy: string[];
}

export interface GameInviteRecord {
  inviteId: string;
  tableId: string;
  tableName: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserEmail: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  createdAt: number;
  expiresAt: number;
}

// Subscribe to running game tables where not all seats are taken by real players
export function subscribeToRunningTables(
  callback: (tables: FirestoreTableSummary[]) => void
): () => void {
  const tablesRef = collection(db, 'tables');
  // Order by last active
  const q = query(tablesRef, orderBy('updatedAt', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: FirestoreTableSummary[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirestoreTableSummary;
        // Filter: only show if not completed and has available seats (humanPlayerCount < 4)
        if (!data.isCompleted && data.humanPlayerCount < 4) {
          list.push(data);
        }
      });
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'tables');
    }
  );
}

// Subscribe to completed games archive
export function subscribeToCompletedGames(
  callback: (games: CompletedGameRecord[]) => void
): () => void {
  const gamesRef = collection(db, 'completed_games');
  const q = query(gamesRef, orderBy('completedAt', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: CompletedGameRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as CompletedGameRecord);
      });
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'completed_games');
    }
  );
}

// Sync table state from server/client to Firestore
export async function syncTableToFirestore(state: TableState, createdBy?: string, createdByName?: string): Promise<void> {
  const tableRef = doc(db, 'tables', state.tableId);
  const humanCount = state.players.filter((p) => !p.isAgent).length;
  const availableCount = 4 - humanCount;

  const data: Partial<FirestoreTableSummary> = {
    tableId: state.tableId,
    tableName: state.tableName,
    updatedAt: Date.now(),
    status: state.status,
    targetScore: state.targetScore,
    currentRound: state.currentRound,
    humanPlayerCount: humanCount,
    availableSeatsCount: availableCount,
    playerNames: state.players.map((p) => p.name),
    isCompleted: state.status === 'GAME_OVER' || state.status === 'COMPLETED_CLOSED',
  };

  if (createdBy) data.createdBy = createdBy;
  if (createdByName) data.createdByName = createdByName;

  try {
    await setDoc(tableRef, data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tables/${state.tableId}`);
  }
}

// Archive a finished game with complete round-by-round points
export async function archiveCompletedGame(state: TableState, closedByUserId: string): Promise<string> {
  const gameId = `game_${state.tableId}_${Date.now()}`;
  const gameRef = doc(db, 'completed_games', gameId);

  const champion = state.gameWinnerSeat !== null ? state.players[state.gameWinnerSeat] : state.players[0];

  const roundsHistory = state.tricksHistory.length > 0
    ? [
        {
          roundNumber: state.currentRound,
          winnerName: champion.name,
          pointsAwarded: champion.roundScore,
          playerScores: state.players.map((p) => ({
            playerName: p.name,
            roundScore: p.roundScore,
            cumulativeScore: p.cumulativeScore,
          })),
        },
      ]
    : [];

  const record: CompletedGameRecord = {
    gameId,
    tableId: state.tableId,
    tableName: state.tableName,
    completedAt: Date.now(),
    winnerId: champion.id,
    winnerName: champion.name,
    winnerCumulativeScore: champion.cumulativeScore,
    roundsHistory,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isAgent: p.isAgent,
      cumulativeScore: p.cumulativeScore,
    })),
    closedBy: [closedByUserId],
  };

  try {
    await setDoc(gameRef, record);
    // Mark table as completed/closed
    await setDoc(doc(db, 'tables', state.tableId), { isCompleted: true, status: 'COMPLETED_CLOSED' }, { merge: true });
    return gameId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `completed_games/${gameId}`);
  }
}

// Invites
export async function sendGameInvite(
  tableId: string,
  tableName: string,
  fromUserId: string,
  fromUserName: string,
  toUserId: string,
  toUserEmail: string
): Promise<string> {
  const inviteId = `inv_${tableId}_${toUserId}_${Date.now()}`;
  const inviteRef = doc(db, 'invites', inviteId);

  const invite: GameInviteRecord = {
    inviteId,
    tableId,
    tableName,
    fromUserId,
    fromUserName,
    toUserId,
    toUserEmail,
    status: 'PENDING',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60 * 1000, // 1 minute auto-expire
  };

  try {
    await setDoc(inviteRef, invite);
    return inviteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `invites/${inviteId}`);
  }
}

export function subscribeToIncomingInvites(
  userId: string,
  callback: (invites: GameInviteRecord[]) => void
): () => void {
  const invitesRef = collection(db, 'invites');
  const q = query(invitesRef, where('toUserId', '==', userId), where('status', '==', 'PENDING'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: GameInviteRecord[] = [];
      const now = Date.now();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as GameInviteRecord;
        if (data.expiresAt > now) {
          list.push(data);
        }
      });
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'invites');
    }
  );
}

export async function respondToInvite(inviteId: string, status: 'ACCEPTED' | 'REJECTED'): Promise<void> {
  const inviteRef = doc(db, 'invites', inviteId);
  try {
    await updateDoc(inviteRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `invites/${inviteId}`);
  }
}

// User Search to find online users to invite
export async function searchUsers(searchTerm: string, currentUid: string): Promise<{ uid: string; username: string; email: string | null }[]> {
  if (!searchTerm.trim()) return [];
  const term = searchTerm.trim().toLowerCase();
  const usersRef = collection(db, 'users');
  try {
    const snap = await getDocs(query(usersRef, limit(20)));
    const results: { uid: string; username: string; email: string | null }[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.uid !== currentUid) {
        const uName = (data.username || '').toLowerCase();
        const uEmail = (data.email || '').toLowerCase();
        if (uName.includes(term) || uEmail.includes(term)) {
          results.push({
            uid: data.uid,
            username: data.username || data.displayName || 'Player',
            email: data.email || null,
          });
        }
      }
    });
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users');
  }
}
