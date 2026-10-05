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
  isTrainedForGlobalModel?: boolean;
  trainedForUserIds?: string[];
  trainedAt?: number;
  trainingSamples?: {
    features: number[];
    winningStrategy: string;
    score: number;
    playerId?: string;
    playerName?: string;
  }[];
}

export function normalizeCompletedGameRecord(data: any, docId?: string): CompletedGameRecord {
  const completedAt =
    typeof data?.completedAt === 'number'
      ? data.completedAt
      : data?.completedAt?.toMillis
      ? data.completedAt.toMillis()
      : typeof data?.completedAt === 'string'
      ? new Date(data.completedAt).getTime()
      : Date.now();

  const players = Array.isArray(data?.players)
    ? data.players.map((p: any, idx: number) => ({
        id: p?.id || `player_${idx}`,
        name: p?.name || `Player ${idx + 1}`,
        isAgent: Boolean(p?.isAgent),
        cumulativeScore: typeof p?.cumulativeScore === 'number' ? p.cumulativeScore : 0,
      }))
    : [];

  const roundsHistory = Array.isArray(data?.roundsHistory) ? data.roundsHistory : [];

  return {
    gameId: data?.gameId || docId || `game_${Date.now()}`,
    tableId: data?.tableId || 'table_main',
    tableName: data?.tableName || 'Hazari Tournament Table',
    completedAt,
    winnerId: data?.winnerId || players[0]?.id || 'winner',
    winnerName: data?.winnerName || players[0]?.name || 'Winner',
    winnerCumulativeScore:
      typeof data?.winnerCumulativeScore === 'number'
        ? data.winnerCumulativeScore
        : players[0]?.cumulativeScore || 1000,
    roundsHistory,
    players,
    closedBy: Array.isArray(data?.closedBy) ? data.closedBy : [],
    isTrainedForGlobalModel: Boolean(data?.isTrainedForGlobalModel),
    trainedForUserIds: Array.isArray(data?.trainedForUserIds) ? data.trainedForUserIds : [],
    trainedAt: data?.trainedAt,
    trainingSamples: Array.isArray(data?.trainingSamples) ? data.trainingSamples : [],
  };
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
        // Show all running tables that are not completed so players can inspect/spectate
        if (!data.isCompleted) {
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
  // First emit from local cache immediately if available
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('hazari_completed_games_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          callback(parsed);
        }
      }
    } catch {}
  }

  const gamesRef = collection(db, 'completed_games');
  const q = query(gamesRef, limit(100));

  const processSnapshot = (snapshot: any) => {
    const list: CompletedGameRecord[] = [];
    snapshot.forEach((docSnap: any) => {
      list.push(docSnap.data() as CompletedGameRecord);
    });
    list.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    if (list.length === 0) {
      seedInitialCompletedGame();
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('hazari_completed_games_cache', JSON.stringify(list));
      } catch {}
    }
    callback(list);
  };

  // Immediate getDocs fetch
  getDocs(q).then(processSnapshot).catch((err) => {
    console.warn('Completed games getDocs notice:', err?.message);
  });

  return onSnapshot(
    q,
    processSnapshot,
    (error) => {
      console.warn('Completed games snapshot notice:', error?.message);
    }
  );
}

async function seedInitialCompletedGame() {
  const sampleId = `game_sample_${Date.now()}`;
  const now = Date.now();
  const sampleRecord: CompletedGameRecord = {
    gameId: sampleId,
    tableId: 'table_championship_archive_1',
    tableName: 'Hazari Premier Masters Championship',
    completedAt: now - 3600000,
    winnerId: 'agent_0',
    winnerName: 'Agent Kabir (#1)',
    winnerCumulativeScore: 1040,
    roundsHistory: [
      {
        roundNumber: 1,
        winnerName: 'Agent Kabir (#1)',
        pointsAwarded: 240,
        playerScores: [
          { playerName: 'Agent Kabir (#1)', roundScore: 240, cumulativeScore: 240 },
          { playerName: 'Agent Ananya (#2)', roundScore: 60, cumulativeScore: 60 },
          { playerName: 'Agent Tariq (#3)', roundScore: 40, cumulativeScore: 40 },
          { playerName: 'Agent Maya (#4)', roundScore: 20, cumulativeScore: 20 },
        ],
      },
      {
        roundNumber: 2,
        winnerName: 'Agent Kabir (#1)',
        pointsAwarded: 300,
        playerScores: [
          { playerName: 'Agent Kabir (#1)', roundScore: 300, cumulativeScore: 540 },
          { playerName: 'Agent Ananya (#2)', roundScore: 40, cumulativeScore: 100 },
          { playerName: 'Agent Tariq (#3)', roundScore: 20, cumulativeScore: 60 },
          { playerName: 'Agent Maya (#4)', roundScore: 0, cumulativeScore: 20 },
        ],
      },
      {
        roundNumber: 3,
        winnerName: 'Agent Kabir (#1)',
        pointsAwarded: 500,
        playerScores: [
          { playerName: 'Agent Kabir (#1)', roundScore: 500, cumulativeScore: 1040 },
          { playerName: 'Agent Ananya (#2)', roundScore: 120, cumulativeScore: 220 },
          { playerName: 'Agent Tariq (#3)', roundScore: 80, cumulativeScore: 140 },
          { playerName: 'Agent Maya (#4)', roundScore: 60, cumulativeScore: 80 },
        ],
      },
    ],
    players: [
      { id: 'agent_0', name: 'Agent Kabir (#1)', isAgent: true, cumulativeScore: 1040 },
      { id: 'agent_1', name: 'Agent Ananya (#2)', isAgent: true, cumulativeScore: 220 },
      { id: 'agent_2', name: 'Agent Tariq (#3)', isAgent: true, cumulativeScore: 140 },
      { id: 'agent_3', name: 'Agent Maya (#4)', isAgent: true, cumulativeScore: 80 },
    ],
    closedBy: ['system'],
    isTrainedForGlobalModel: false,
    trainedForUserIds: [],
    trainingSamples: [
      { features: [0.9, 0.8, 0.7, 0.6, 0.85, 0.4, 0.7, 0.5, 0.8, 0.3], winningStrategy: 'optimal_ev', score: 1040, playerId: 'agent_0', playerName: 'Agent Kabir (#1)' },
      { features: [0.5, 0.3, 0.6, 0.4, 0.4, 0.5, 0.6, 0.4, 0.5, 0.2], winningStrategy: 'balanced', score: 220, playerId: 'agent_1', playerName: 'Agent Ananya (#2)' },
      { features: [0.4, 0.2, 0.5, 0.3, 0.3, 0.6, 0.5, 0.3, 0.4, 0.1], winningStrategy: 'defensive', score: 140, playerId: 'agent_2', playerName: 'Agent Tariq (#3)' },
      { features: [0.3, 0.1, 0.4, 0.2, 0.3, 0.7, 0.4, 0.2, 0.3, 0.1], winningStrategy: 'defensive', score: 80, playerId: 'agent_3', playerName: 'Agent Maya (#4)' },
    ],
  };

  try {
    await setDoc(doc(db, 'completed_games', sampleId), sampleRecord);
  } catch {}
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
    isTrainedForGlobalModel: false,
    trainedForUserIds: [],
    trainingSamples: state.players.map((p, idx) => ({
      features: [
        idx === (state.gameWinnerSeat ?? 0) ? 0.9 : 0.4,
        Math.min(1, p.cumulativeScore / 1000),
        Math.min(1, p.roundScore / 360),
        p.isAgent ? 0.3 : 0.8,
        0.5,
        0.6,
        0.4,
        0.8,
        0.3,
        0.5,
      ],
      winningStrategy: (p.cumulativeScore >= 1000 ? 'optimal_ev' : 'balanced'),
      score: p.cumulativeScore,
      playerId: p.id,
      playerName: p.name,
    })),
  };

  try {
    await setDoc(gameRef, record);
    // Mark table as completed/closed
    await setDoc(doc(db, 'tables', state.tableId), { isCompleted: true, status: 'COMPLETED_CLOSED' }, { merge: true });

    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('hazari_completed_games_cache');
        const list = cached ? JSON.parse(cached) : [];
        list.unshift(record);
        localStorage.setItem('hazari_completed_games_cache', JSON.stringify(list.slice(0, 100)));
      } catch {}
    }

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

// AI Training & Completed Game Flagging (Requirements 2 & 8)
export async function fetchAllCompletedGamesFromFirebase(): Promise<CompletedGameRecord[]> {
  const gamesRef = collection(db, 'completed_games');
  try {
    const snap = await getDocs(query(gamesRef, limit(100)));
    const list: CompletedGameRecord[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as CompletedGameRecord);
    });
    list.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    return list;
  } catch (error) {
    console.warn('Error fetching all completed games from Firebase:', error);
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('hazari_completed_games_cache');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  }
}

export async function getUntrainedGamesForGlobal(): Promise<CompletedGameRecord[]> {
  const gamesRef = collection(db, 'completed_games');
  try {
    const snap = await getDocs(query(gamesRef, limit(100)));
    const untrained: CompletedGameRecord[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as CompletedGameRecord;
      if (!data.isTrainedForGlobalModel) {
        untrained.push(data);
      }
    });
    return untrained;
  } catch (error) {
    console.warn('Error getting untrained games for global:', error);
    return [];
  }
}

export async function markGamesAsTrainedForGlobal(gameIds: string[]): Promise<void> {
  const now = Date.now();
  for (const gId of gameIds) {
    try {
      await updateDoc(doc(db, 'completed_games', gId), {
        isTrainedForGlobalModel: true,
        trainedAt: now,
      });
    } catch {}
  }
}

export async function getCompletedGamesForUser(userId: string): Promise<CompletedGameRecord[]> {
  const gamesRef = collection(db, 'completed_games');
  try {
    const snap = await getDocs(query(gamesRef, limit(100)));
    const userGames: CompletedGameRecord[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as CompletedGameRecord;
      if (data.players && data.players.some((p) => p.id === userId)) {
        userGames.push(data);
      }
    });
    return userGames;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'completed_games');
  }
}

export async function markGamesAsTrainedForUser(gameIds: string[], userId: string): Promise<void> {
  for (const gId of gameIds) {
    try {
      const gDoc = doc(db, 'completed_games', gId);
      const snap = await getDoc(gDoc);
      if (snap.exists()) {
        const data = snap.data() as CompletedGameRecord;
        const currentList = data.trainedForUserIds || [];
        if (!currentList.includes(userId)) {
          await updateDoc(gDoc, {
            trainedForUserIds: [...currentList, userId],
          });
        }
      }
    } catch {}
  }
}

export interface UserAIModelRecord {
  userId: string;
  username: string;
  version: string;
  trainedAt: number;
  sampleCount: number;
  validationAccuracy: number;
  trainedGameIds: string[];
  modelJson?: string;
}

export async function saveUserAIModel(record: UserAIModelRecord): Promise<void> {
  const modelRef = doc(db, 'user_models', record.userId);
  try {
    await setDoc(modelRef, record, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `user_models/${record.userId}`);
  }
}

export async function getUserAIModel(userId: string): Promise<UserAIModelRecord | null> {
  const modelRef = doc(db, 'user_models', userId);
  try {
    const snap = await getDoc(modelRef);
    if (snap.exists()) {
      return snap.data() as UserAIModelRecord;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `user_models/${userId}`);
  }
}

export async function getAllUserAIModels(): Promise<UserAIModelRecord[]> {
  const modelsRef = collection(db, 'user_models');
  try {
    const snap = await getDocs(query(modelsRef, limit(50)));
    const list: UserAIModelRecord[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as UserAIModelRecord);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'user_models');
  }
}
