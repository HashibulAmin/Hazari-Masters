import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Card, HandGroups, TableState, TrickPlay, InternalPlayerHand } from '../core/hazari/types';

export interface TableSliceState {
  tableState: TableState | null;
  localHand: InternalPlayerHand | null;
  userSeatIndex: number | null;
  isConnecting: boolean;
  isConnected: boolean;
  isReconnecting: boolean;
  connectionError: string | null;
  lastSyncTimestamp: number;
  optimisticPlayPending: boolean;
  pipelineStatus: {
    totalGamesRecorded: number;
    modelMetadata: {
      version: string;
      trainedAt: number;
      sampleCount: number;
      validationAccuracy: number;
      featureImportances: Record<string, number>;
      dailyTrainScheduledAt: number;
    };
    recentGames: any[];
    strategyWinRates: Record<string, { wins: number; total: number; winPct: number }>;
  } | null;
}

const initialState: TableSliceState = {
  tableState: null,
  localHand: null,
  userSeatIndex: null,
  isConnecting: true,
  isConnected: false,
  isReconnecting: false,
  connectionError: null,
  lastSyncTimestamp: 0,
  optimisticPlayPending: false,
  pipelineStatus: null,
};

export const tableSlice = createSlice({
  name: 'table',
  initialState,
  reducers: {
    setConnectionStatus: (
      state,
      action: PayloadAction<{ connected: boolean; reconnecting?: boolean; error?: string | null }>
    ) => {
      state.isConnected = action.payload.connected;
      state.isConnecting = false;
      if (action.payload.reconnecting !== undefined) {
        state.isReconnecting = action.payload.reconnecting;
      }
      if (action.payload.error !== undefined) {
        state.connectionError = action.payload.error;
      }
    },
    tableJoined: (
      state,
      action: PayloadAction<{
        seatIndex: number | null;
        tableState: TableState;
        localHand: InternalPlayerHand | null;
        pipelineStatus?: any;
      }>
    ) => {
      state.userSeatIndex = action.payload.seatIndex;
      state.tableState = action.payload.tableState;
      state.localHand = action.payload.localHand;
      if (action.payload.pipelineStatus) {
        state.pipelineStatus = action.payload.pipelineStatus;
      }
      state.lastSyncTimestamp = Date.now();
      state.isConnected = true;
      state.isConnecting = false;
      state.isReconnecting = false;
      state.connectionError = null;
    },
    tableStateUpdated: (state, action: PayloadAction<{ tableState: TableState }>) => {
      state.tableState = action.payload.tableState;
      state.lastSyncTimestamp = Date.now();
      state.optimisticPlayPending = false;
    },
    privateHandUpdated: (state, action: PayloadAction<{ seatIndex: number; hand: InternalPlayerHand | null }>) => {
      if (state.userSeatIndex === action.payload.seatIndex) {
        state.localHand = action.payload.hand;
      }
    },
    setPipelineStatus: (state, action: PayloadAction<any>) => {
      state.pipelineStatus = action.payload;
    },
    optimisticArrangeHand: (state, action: PayloadAction<{ groups: HandGroups; strategy?: string }>) => {
      if (state.localHand) {
        state.localHand.arrangedGroups = action.payload.groups;
        state.localHand.isReady = true;
      }
      if (state.tableState && state.userSeatIndex !== null) {
        state.tableState.players[state.userSeatIndex].isReady = true;
      }
    },
    optimisticPlayTrick: (state) => {
      if (!state.tableState || state.userSeatIndex === null || !state.localHand?.arrangedGroups) return;
      state.optimisticPlayPending = true;
      const trickNum = state.tableState.currentTrick;
      let cards: Card[] = [];
      if (trickNum === 1) cards = state.localHand.arrangedGroups.group1;
      else if (trickNum === 2) cards = state.localHand.arrangedGroups.group2;
      else if (trickNum === 3) cards = state.localHand.arrangedGroups.group3;
      else cards = state.localHand.arrangedGroups.group4;

      const player = state.tableState.players[state.userSeatIndex];
      const optimisticPlay: TrickPlay = {
        playerId: player.id,
        playerName: player.name,
        seatIndex: state.userSeatIndex,
        isAgent: false,
        cards,
        evaluation: {
          category: 1,
          categoryName: 'Played',
          comparisonTuple: [],
          label: 'Played',
          points: cards.reduce((sum, c) => sum + c.points, 0),
        },
        points: cards.reduce((sum, c) => sum + c.points, 0),
        playOrder: state.tableState.currentTrickPlays.length,
      };

      state.tableState.currentTrickPlays.push(optimisticPlay);
      player.hasPlayedCurrentTrick = true;
    },
    seatLeft: (state) => {
      state.userSeatIndex = null;
      state.localHand = null;
    },
  },
});

export const {
  setConnectionStatus,
  tableJoined,
  tableStateUpdated,
  privateHandUpdated,
  setPipelineStatus,
  optimisticArrangeHand,
  optimisticPlayTrick,
  seatLeft,
} = tableSlice.actions;

export default tableSlice.reducer;
