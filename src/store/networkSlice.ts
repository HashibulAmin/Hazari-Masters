import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface NetworkLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface NetworkSliceState {
  userId: string;
  userName: string;
  userAvatar: string;
  tableId: string;
  audioEnabled: boolean;
  // Network simulation states
  simulateLagMs: number;
  isSimulatedDisconnect: boolean;
  logs: NetworkLog[];
}

const getStoredUserId = (): string => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('hazari_user_id');
    if (stored) return stored;
    const newId = `user_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('hazari_user_id', newId);
    return newId;
  }
  return `user_${Math.random().toString(36).substring(2, 9)}`;
};

const getStoredUserName = (): string => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('hazari_user_name');
    if (stored) return stored;
  }
  const defaultNames = ['Tiger of Dhaka', 'Chittagong Ace', 'Sylhet Sultan', 'Padma Champion'];
  const name = defaultNames[Math.floor(Math.random() * defaultNames.length)];
  if (typeof window !== 'undefined') {
    localStorage.setItem('hazari_user_name', name);
  }
  return name;
};

const initialState: NetworkSliceState = {
  userId: getStoredUserId(),
  userName: getStoredUserName(),
  userAvatar: '👑',
  tableId: 'main',
  audioEnabled: true,
  simulateLagMs: 0,
  isSimulatedDisconnect: false,
  logs: [
    {
      id: 'init',
      timestamp: Date.now(),
      level: 'info',
      message: 'Redux real-time WebSocket state manager initialized.',
    },
  ],
};

export const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setUserName: (state, action: PayloadAction<string>) => {
      state.userName = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('hazari_user_name', action.payload);
      }
    },
    setUserCredentials: (state, action: PayloadAction<{ userId: string; userName: string }>) => {
      state.userId = action.payload.userId;
      state.userName = action.payload.userName;
      if (typeof window !== 'undefined') {
        localStorage.setItem('hazari_user_id', action.payload.userId);
        localStorage.setItem('hazari_user_name', action.payload.userName);
      }
    },
    setTableId: (state, action: PayloadAction<string>) => {
      state.tableId = action.payload;
    },
    toggleAudio: (state) => {
      state.audioEnabled = !state.audioEnabled;
    },
    setSimulateLagMs: (state, action: PayloadAction<number>) => {
      state.simulateLagMs = action.payload;
      state.logs.unshift({
        id: Math.random().toString(),
        timestamp: Date.now(),
        level: 'warn',
        message: `Simulated network delay adjusted to ${action.payload}ms.`,
      });
    },
    setSimulatedDisconnect: (state, action: PayloadAction<boolean>) => {
      state.isSimulatedDisconnect = action.payload;
      state.logs.unshift({
        id: Math.random().toString(),
        timestamp: Date.now(),
        level: action.payload ? 'error' : 'success',
        message: action.payload ? 'Simulated socket dropped. Triggering 15s grace period & state recovery.' : 'Socket reconnected. State recovery payload verified.',
      });
    },
    addLog: (state, action: PayloadAction<{ level: 'info' | 'warn' | 'error' | 'success'; message: string }>) => {
      state.logs.unshift({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        level: action.payload.level,
        message: action.payload.message,
      });
      if (state.logs.length > 50) {
        state.logs.pop();
      }
    },
    clearLogs: (state) => {
      state.logs = [];
    },
  },
});

export const {
  setUserName,
  setUserCredentials,
  setTableId,
  toggleAudio,
  setSimulateLagMs,
  setSimulatedDisconnect,
  addLog,
  clearLogs,
} = networkSlice.actions;

export default networkSlice.reducer;
