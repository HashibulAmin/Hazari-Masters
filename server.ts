import express from 'express';
import http from 'http';
import path from 'path';
import { Server, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { TableInstance, InternalPlayerHand } from './server/tableManager';
import { GameDataPipeline } from './server/gamePipeline';
import { runHazariCoreTests } from './src/core/hazari/__tests__/hazari.test';
import { HandGroups, TableState } from './src/core/hazari/types';
import { ArrangementStrategy } from './src/core/hazari/arranger';

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());

// Initialize sequential Game Data Pipeline & Daily Training Scheduler
const gamePipeline = new GameDataPipeline((updatedMeta) => {
  io.emit('model:updated', updatedMeta);
});

// Global table storage (tableId -> TableInstance)
const tables = new Map<string, TableInstance>();

function getOrCreateTable(tableId: string = 'main', tableName: string = 'Hazari High Roller Table'): TableInstance {
  if (!tables.has(tableId)) {
    const instance = new TableInstance(
      tableId,
      tableName,
      (tableState, privateHands) => {
        // Broadcast state update to everyone in the room
        broadcastTableUpdate(tableId, tableState, privateHands);
      },
      (tableState, winnerSeat, hands, strategies) => {
        // Send finished game data to sequential training pipeline
        const record = gamePipeline.ingestFinishedGame(tableState, winnerSeat, hands, strategies);
        io.to(tableId).emit('pipeline:game_recorded', {
          record,
          pipelineStatus: gamePipeline.getPipelineStatus(),
        });
      }
    );
    tables.set(tableId, instance);
  }
  return tables.get(tableId)!;
}

function broadcastTableUpdate(tableId: string, state: TableState, privateHands: Map<number, InternalPlayerHand>) {
  // Broadcast public state to room
  io.to(tableId).emit('table:state_update', { tableState: state });

  // Send individualized private hand updates to connected human sockets
  state.players.forEach((player, seatIndex) => {
    if (!player.isAgent && player.socketId) {
      const hand = privateHands.get(seatIndex);
      io.to(player.socketId).emit('table:private_hand', {
        seatIndex,
        hand: hand || null,
      });
    }
  });
}

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    game: 'Hazari Masters',
    time: Date.now(),
    activeTables: tables.size,
    pipeline: {
      totalGames: gamePipeline.getPipelineStatus().totalGamesRecorded,
      modelAccuracy: gamePipeline.getPipelineStatus().modelMetadata.validationAccuracy,
    },
  });
});

app.get('/api/table/:tableId', (req, res) => {
  const table = tables.get(req.params.tableId);
  if (!table) {
    return res.status(404).json({ error: 'Table not found' });
  }
  res.json({ state: table.state });
});

app.post('/api/test/run-unit-tests', (req, res) => {
  const testResults = runHazariCoreTests();
  res.json(testResults);
});

// AI Model & Data Pipeline API endpoints
app.get('/api/model/status', (req, res) => {
  res.json(gamePipeline.getPipelineStatus());
});

app.post('/api/model/train-now', (req, res) => {
  const trainResult = gamePipeline.runDailyTraining();
  res.json({
    success: true,
    result: trainResult,
    status: gamePipeline.getPipelineStatus(),
  });
});

app.post('/api/model/train-from-firebase', express.json({ limit: '10mb' }), (req, res) => {
  const games = req.body?.games || [];
  const trainResult = gamePipeline.trainOnFirebaseGames(games);
  res.json({
    success: true,
    result: trainResult,
    status: gamePipeline.getPipelineStatus(),
  });
});

// Periodic abandonment monitor: checks every 5 mins for tables inactive > 30 minutes
setInterval(() => {
  tables.forEach((table) => {
    table.checkAbandonedGameTimeout(30 * 60 * 1000);
  });
}, 5 * 60 * 1000);

app.post('/api/table/:tableId/check-abandonment', (req, res) => {
  const table = tables.get(req.params.tableId);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  const timeoutMs = typeof req.body?.timeoutMs === 'number' ? req.body.timeoutMs : 30 * 60 * 1000;
  const result = table.checkAbandonedGameTimeout(timeoutMs);
  res.json({ success: true, result, state: table.state });
});

// Socket.io handlers
io.on('connection', (socket: Socket) => {
  let currentTableId = 'main';
  let userSeatIndex: number | null = null;
  let currentUserId: string | null = null;

  socket.on(
    'join_table',
    ({
      tableId = 'main',
      tableName,
      userId,
      userName,
      preferredSeat,
    }: {
      tableId?: string;
      tableName?: string;
      userId: string;
      userName: string;
      preferredSeat?: number;
    }) => {
      currentTableId = tableId;
      currentUserId = userId;
      socket.join(tableId);

      const table = getOrCreateTable(tableId, tableName);
      const joinResult = table.joinTable(userId, userName, socket.id, preferredSeat);

      if (joinResult.success) {
        userSeatIndex = joinResult.seatIndex;
        const clientView = table.getClientView(userSeatIndex);

        socket.emit('table:joined', {
          seatIndex: userSeatIndex,
          tableState: clientView.tableState,
          localHand: clientView.localHand,
          pipelineStatus: gamePipeline.getPipelineStatus(),
        });
      } else {
        socket.emit('table:join_error', { error: joinResult.error });
      }
    }
  );

  socket.on(
    'inspect_table',
    ({
      tableId = 'main',
      tableName,
      userId,
      userName,
    }: {
      tableId?: string;
      tableName?: string;
      userId: string;
      userName: string;
    }) => {
      currentTableId = tableId;
      currentUserId = userId;
      socket.join(tableId);

      const table = getOrCreateTable(tableId, tableName);
      userSeatIndex = null;

      socket.emit('table:joined', {
        seatIndex: null,
        tableState: table.state,
        localHand: null,
        pipelineStatus: gamePipeline.getPipelineStatus(),
      });

      // If game is in WAITING state, start deal so inspector can observe live gameplay
      if (table.state.status === 'WAITING') {
        table.startDeal();
      }
    }
  );

  socket.on(
    'submit_arrangement',
    ({
      tableId = 'main',
      groups,
      strategy = 'optimal_ev',
    }: {
      tableId?: string;
      groups: HandGroups;
      strategy?: ArrangementStrategy;
    }) => {
      const table = tables.get(tableId);
      if (!table || userSeatIndex === null) return;

      const result = table.submitArrangement(userSeatIndex, groups, strategy);
      if (!result.success) {
        socket.emit('table:action_error', { error: result.error });
      }
    }
  );

  socket.on('play_trick', ({ tableId = 'main' }: { tableId?: string }) => {
    const table = tables.get(tableId);
    if (!table || userSeatIndex === null) return;

    const result = table.playTrick(userSeatIndex);
    if (!result.success) {
      socket.emit('table:action_error', { error: result.error });
    }
  });

  socket.on('leave_seat', ({ tableId = 'main' }: { tableId?: string }) => {
    const table = tables.get(tableId);
    if (!table || !currentUserId) return;

    table.leaveSeat(currentUserId);
    userSeatIndex = null;
    socket.emit('table:left_seat');
  });

  socket.on('start_deal', ({ tableId = 'main' }: { tableId?: string }) => {
    const table = tables.get(tableId);
    if (table) {
      table.startDeal();
    }
  });

  socket.on('shuffle_table', ({ tableId = 'main' }: { tableId?: string }) => {
    const table = tables.get(tableId);
    if (table) {
      table.shuffleTable();
    }
  });

  socket.on('request_state', ({ tableId = 'main' }: { tableId?: string }) => {
    const table = tables.get(tableId);
    if (!table) return;

    const seat = userSeatIndex ?? 0;
    const clientView = table.getClientView(seat);
    socket.emit('table:state_update', { tableState: clientView.tableState });
    if (clientView.localHand) {
      socket.emit('table:private_hand', { seatIndex: seat, hand: clientView.localHand });
    }
    socket.emit('pipeline:status_update', gamePipeline.getPipelineStatus());
  });

  socket.on('request_pipeline_status', () => {
    socket.emit('pipeline:status_update', gamePipeline.getPipelineStatus());
  });

  socket.on('trigger_daily_train', () => {
    const res = gamePipeline.runDailyTraining();
    io.emit('pipeline:status_update', gamePipeline.getPipelineStatus());
  });

  socket.on('complete_game', ({ tableId = 'main' }: { tableId?: string }) => {
    const table = tables.get(tableId);
    if (table) {
      table.completeGame(currentUserId || 'user');
      io.to(tableId).emit('table:state_update', { tableState: table.getClientView(0).tableState });
    }
  });

  socket.on('disconnect', () => {
    const table = tables.get(currentTableId);
    if (table) {
      table.handlePlayerDisconnect(socket.id);
    }
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`Hazari Masters server running on port ${PORT} [${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
  });
}

startServer();
