import { Middleware } from '@reduxjs/toolkit';
import { io, Socket } from 'socket.io-client';
import {
  setConnectionStatus,
  tableJoined,
  tableStateUpdated,
  privateHandUpdated,
  setPipelineStatus,
  seatLeft,
} from './tableSlice';
import { addLog } from './networkSlice';
import { HandGroups } from '../core/hazari/types';

let socket: Socket | null = null;

export const socketMiddleware: Middleware = (store) => {
  return (next) => (action: any) => {
    if (action.type === 'socket/init') {
      if (socket) return next(action);

      socket = io({
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      socket.on('connect', () => {
        store.dispatch(setConnectionStatus({ connected: true, reconnecting: false }));
        store.dispatch(addLog({ level: 'success', message: `Connected to Hazari game server (ID: ${socket?.id}).` }));

        const networkState = store.getState().network;
        socket?.emit('join_table', {
          tableId: networkState.tableId,
          userId: networkState.userId,
          userName: networkState.userName,
        });
      });

      socket.on('disconnect', (reason) => {
        store.dispatch(setConnectionStatus({ connected: false, reconnecting: true, error: reason }));
        store.dispatch(addLog({ level: 'warn', message: `Disconnected from game server (${reason}). Auto-reconnecting...` }));
      });

      socket.on('connect_error', (err) => {
        store.dispatch(setConnectionStatus({ connected: false, reconnecting: true, error: err.message }));
        store.dispatch(addLog({ level: 'error', message: `Connection error: ${err.message}` }));
      });

      socket.on('table:joined', (payload) => {
        store.dispatch(tableJoined(payload));
        store.dispatch(addLog({
          level: 'success',
          message: `Seated at Table '${payload.tableState.tableName}', Seat ${payload.seatIndex + 1}.`,
        }));
      });

      socket.on('table:state_update', (payload) => {
        store.dispatch(tableStateUpdated(payload));
      });

      socket.on('table:private_hand', (payload) => {
        store.dispatch(privateHandUpdated(payload));
      });

      socket.on('pipeline:status_update', (payload) => {
        store.dispatch(setPipelineStatus(payload));
      });

      socket.on('pipeline:game_recorded', (payload) => {
        if (payload.pipelineStatus) {
          store.dispatch(setPipelineStatus(payload.pipelineStatus));
        }
        store.dispatch(addLog({
          level: 'success',
          message: `[Pipeline] Game data ingested into AI Training set (Winner: ${payload.record.winnerName} with ${payload.record.winnerStrategy.toUpperCase()}).`,
        }));
      });

      socket.on('model:updated', (payload) => {
        store.dispatch(addLog({
          level: 'info',
          message: `[AI Model] Offline Model retrained successfully (Acc: ${(payload.validationAccuracy * 100).toFixed(1)}%, Samples: ${payload.sampleCount}).`,
        }));
      });

      socket.on('table:action_error', (payload) => {
        store.dispatch(addLog({ level: 'error', message: `Server error: ${payload.error}` }));
      });

      socket.on('table:left_seat', () => {
        store.dispatch(seatLeft());
        store.dispatch(addLog({ level: 'info', message: 'You left your seat. AI Agent took over.' }));
      });
    }

    const emitWithLag = (eventName: string, payload: any) => {
      if (!socket || !socket.connected) {
        store.dispatch(addLog({ level: 'error', message: `Cannot send ${eventName}: Socket offline.` }));
        return;
      }
      const lag = store.getState().network.simulateLagMs;
      if (lag > 0) {
        store.dispatch(addLog({ level: 'warn', message: `[Simulated Lag ${lag}ms] Sending ${eventName}...` }));
        setTimeout(() => {
          socket?.emit(eventName, payload);
        }, lag);
      } else {
        socket.emit(eventName, payload);
      }
    };

    if (action.type === 'socket/submitArrangement') {
      const payload = action.payload;
      const groups = payload.groups || payload;
      const strategy = payload.strategy || 'optimal_ev';
      emitWithLag('submit_arrangement', {
        tableId: store.getState().network.tableId,
        groups: groups as HandGroups,
        strategy,
      });
    }

    if (action.type === 'socket/playTrick') {
      emitWithLag('play_trick', {
        tableId: store.getState().network.tableId,
      });
    }

    if (action.type === 'socket/startDeal') {
      emitWithLag('start_deal', {
        tableId: store.getState().network.tableId,
      });
    }

    if (action.type === 'socket/shuffleTable') {
      emitWithLag('shuffle_table', {
        tableId: store.getState().network.tableId,
      });
    }

    if (action.type === 'socket/leaveSeat') {
      emitWithLag('leave_seat', {
        tableId: store.getState().network.tableId,
      });
    }

    if (action.type === 'socket/takeSeat') {
      const net = store.getState().network;
      emitWithLag('join_table', {
        tableId: net.tableId,
        userId: net.userId,
        userName: net.userName,
        preferredSeat: action.payload as number,
      });
    }

    if (action.type === 'socket/switchTable') {
      const { tableId, tableName, userId, userName } = action.payload;
      emitWithLag('join_table', {
        tableId,
        tableName,
        userId,
        userName,
      });
    }

    if (action.type === 'socket/inspectTable') {
      const { tableId, tableName, userId, userName } = action.payload;
      emitWithLag('inspect_table', {
        tableId,
        tableName,
        userId,
        userName,
      });
    }

    if (action.type === 'socket/completeGame') {
      const { tableId } = action.payload;
      emitWithLag('complete_game', { tableId });
    }

    if (action.type === 'socket/triggerDailyTrain') {
      emitWithLag('trigger_daily_train', {});
    }

    if (action.type === 'socket/simulateDisconnect') {
      if (socket) {
        if (socket.connected) {
          socket.emit('simulate_network_disconnect', { tableId: store.getState().network.tableId });
          socket.disconnect();
          store.dispatch(setConnectionStatus({ connected: false, reconnecting: false }));
        } else {
          socket.connect();
        }
      }
    }

    return next(action);
  };
};
