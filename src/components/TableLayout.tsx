import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { optimisticArrangeHand, optimisticPlayTrick } from '../store/tableSlice';
import { toggleAudio, setUserName } from '../store/networkSlice';
import { HandGroups } from '../core/hazari/types';
import { ArrangementStrategy } from '../core/hazari/arranger';
import { PlayerSeat } from './PlayerSeat';
import { TrickArena } from './TrickArena';
import { ArrangementBoard } from './ArrangementBoard';
import { ScoreboardModal } from './ScoreboardModal';
import { NetworkTestModal } from './NetworkTestModal';
import { RulesModal } from './RulesModal';
import { GameWinModal } from './GameWinModal';
import { AIModelModal } from './AIModelModal';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';
import {
  Trophy,
  Activity,
  BookOpen,
  Volume2,
  VolumeX,
  Shuffle,
  Brain,
  ArrowLeft,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';
import { syncTableToFirestore, archiveCompletedGame, recordGameSessionOnWinner } from '../firebase/tableService';
import { advanceMissionProgress } from '../services/dailyMissionsService';

interface TableLayoutProps {
  onBackToDashboard?: () => void;
}

export const TableLayout: React.FC<TableLayoutProps> = ({ onBackToDashboard }) => {
  const dispatch = useAppDispatch();
  const { tableState, localHand, userSeatIndex } = useAppSelector(
    (state) => state.table
  );
  const { audioEnabled, userName, userId } = useAppSelector((state) => state.network);

  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showNetworkTest, setShowNetworkTest] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showAIModelModal, setShowAIModelModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);

  // Sync active table state to Firestore
  React.useEffect(() => {
    if (tableState) {
      syncTableToFirestore(tableState, userId, userName);
    }
  }, [tableState, userId, userName]);

  // Automatically record each match session on Firebase as soon as a game has a winner!
  // Supports multiple sessions played inside a single table/game with separate round and winner tracking
  const lastSavedSessionKeyRef = React.useRef<string>('');
  React.useEffect(() => {
    if (tableState && tableState.status === 'GAME_OVER' && tableState.gameWinnerSeat !== null) {
      const totalWinsCount = tableState.seatWins ? tableState.seatWins.reduce((a, b) => a + b, 0) : 1;
      const sessionKey = `${tableState.tableId}_round${tableState.currentRound}_win${tableState.gameWinnerSeat}_wins${totalWinsCount}`;
      if (lastSavedSessionKeyRef.current !== sessionKey) {
        lastSavedSessionKeyRef.current = sessionKey;
        recordGameSessionOnWinner(tableState, userId, {
          sessionNumber: totalWinsCount > 0 ? totalWinsCount : 1,
          winnerSeat: tableState.gameWinnerSeat,
        }).catch((err) => console.warn('Auto-save winner session notice:', err));

        // Advance daily missions progress
        advanceMissionProgress(userId, 'PLAY_MATCHES', 1).catch(() => {});
        if (userSeatIndex !== null && tableState.gameWinnerSeat === userSeatIndex) {
          advanceMissionProgress(userId, 'WIN_ROUNDS', 1).catch(() => {});
          advanceMissionProgress(userId, 'AGENT_CHALLENGER', 1).catch(() => {});
        }
      }
    }
  }, [tableState, userId, userSeatIndex]);

  // Track player cumulative score for Score Points mission
  const lastScoreRef = React.useRef<number>(0);
  React.useEffect(() => {
    if (userSeatIndex !== null && tableState) {
      const myPlayer = tableState.players[userSeatIndex];
      if (myPlayer && myPlayer.cumulativeScore > lastScoreRef.current) {
        const diff = myPlayer.cumulativeScore - lastScoreRef.current;
        lastScoreRef.current = myPlayer.cumulativeScore;
        advanceMissionProgress(userId, 'SCORE_POINTS', diff).catch(() => {});
      }
    }
  }, [tableState, userSeatIndex, userId]);

  if (!tableState) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-sm font-semibold text-slate-300">Connecting to Hazari Masters real-time table...</p>
      </div>
    );
  }

  // Relative seat mapping so local user is always South (bottom)
  const mySeat = userSeatIndex ?? 0;
  const westSeat = (mySeat + 1) % 4;
  const northSeat = (mySeat + 2) % 4;
  const eastSeat = (mySeat + 3) % 4;

  const playerSouth = tableState.players[mySeat];
  const playerWest = tableState.players[westSeat];
  const playerNorth = tableState.players[northSeat];
  const playerEast = tableState.players[eastSeat];

  const isMyTurn = tableState.status === 'PLAYING_TRICK' && tableState.currentTurnSeat === mySeat;
  const canPlayTrick = Boolean(isMyTurn && !playerSouth.hasPlayedCurrentTrick && localHand?.arrangedGroups);

  const handleLockInArrangement = (groups: HandGroups, strategy: ArrangementStrategy) => {
    // Check if player has any Trio in their arrangement for Daily Mission
    const hasTrio = [groups.group1, groups.group2, groups.group3].some(
      (grp) => grp && grp.length === 3 && grp[0].rank === grp[1].rank && grp[1].rank === grp[2].rank
    );
    if (hasTrio) {
      advanceMissionProgress(userId, 'TRIO_MASTER', 1).catch(() => {});
    }

    // 1. Optimistic local update
    dispatch(optimisticArrangeHand({ groups, strategy }));
    // 2. Emit to server
    dispatch({ type: 'socket/submitArrangement', payload: { groups, strategy } });
  };

  const handlePlayTrick = () => {
    if (!canPlayTrick) return;
    if (audioEnabled) sounds.playCardPlaySound();
    // 1. Optimistic UI update
    dispatch(optimisticPlayTrick());
    // 2. Emit to server
    dispatch({ type: 'socket/playTrick' });
  };

  const handleStartDeal = () => {
    if (audioEnabled) sounds.playDealSound();
    dispatch({ type: 'socket/startDeal' });
  };

  const handleShuffleTable = () => {
    if (audioEnabled) sounds.playDealSound();
    dispatch({ type: 'socket/shuffleTable' });
  };

  const handleTakeSeat = (seatIdx: number) => {
    dispatch({ type: 'socket/takeSeat', payload: seatIdx });
  };

  const handleLeaveSeat = () => {
    dispatch({ type: 'socket/leaveSeat' });
  };

  const handleSaveName = () => {
    if (tempName.trim()) {
      dispatch(setUserName(tempName.trim()));
      setIsEditingName(false);
    }
  };

  const handleCompleteAndArchive = async () => {
    try {
      // Train model on single game table data before completing (Requirement 7)
      await fetch('/api/model/train-now', { method: 'POST' });
    } catch {}

    dispatch({ type: 'socket/completeGame', payload: { tableId: tableState.tableId } });
    await archiveCompletedGame(tableState, userId);

    if (onBackToDashboard) {
      onBackToDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">
      <OfflineIndicator />

      {/* Top Navbar */}
      <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-emerald-950/60 px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg z-20">
        {/* Brand & Room Info */}
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 hover:border-slate-500 transition shadow-sm"
              title="Return to Table Lobby"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Lobby</span>
            </button>
          )}

          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 p-0.5 shadow-md flex items-center justify-center font-serif font-black text-slate-950 text-lg">
            H
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-wide text-slate-100 uppercase">Hazari Masters</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                1000 PTS
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>{tableState.tableName}</span>
              <span>•</span>
              <span className="font-mono text-emerald-400">Round {tableState.currentRound}</span>
            </div>
          </div>
        </div>

        {/* User Profile Quick Edit */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-1 rounded-xl text-xs">
          {isEditingName ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="bg-slate-900 border border-emerald-500/50 rounded px-2 py-0.5 text-xs text-white outline-none w-28"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                className="text-[10px] bg-emerald-600 px-2 py-0.5 rounded font-bold"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setIsEditingName(true)}>
              <span className="text-slate-400">Player:</span>
              <span className="font-bold text-slate-200">{userName}</span>
              <span className="text-[10px] text-slate-500 underline ml-1">Edit</span>
            </div>
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <PWAInstallButton />

          <button
            onClick={() => setShowAIModelModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900 text-xs font-semibold text-purple-300 border border-purple-500/40 transition shadow-sm"
            title="Offline AI Model & Data Pipeline"
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">AI Pipeline</span>
          </button>

          <button
            onClick={() => setShowScoreboard(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-amber-300 border border-amber-500/30 transition shadow-sm"
            title="Scoreboard"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Scores</span>
          </button>

          <button
            onClick={() => setShowNetworkTest(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-emerald-400 border border-emerald-500/30 transition shadow-sm"
            title="Network & State Recovery Test Suite"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Network Tests</span>
          </button>

          <button
            onClick={() => setShowRules(true)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Hazari Rules"
          >
            <BookOpen className="w-4 h-4" />
          </button>

          <button
            onClick={() => dispatch(toggleAudio())}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title={audioEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {tableState.status === 'GAME_OVER' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleShuffleTable}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg animate-pulse"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle Table</span>
              </button>
              {onBackToDashboard && (
                <button
                  onClick={async () => {
                    await archiveCompletedGame(tableState, userId);
                    onBackToDashboard();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg"
                  title="Archive completed match to database and return to lobby"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Archive &amp; Close</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Spectator / Inspector Banner */}
      {userSeatIndex === null && (
        <div className="w-full bg-gradient-to-r from-emerald-950/90 via-slate-900 to-purple-950/90 border-b border-emerald-500/30 px-4 py-1.5 flex items-center justify-between text-xs z-10">
          <div className="flex items-center gap-2 text-emerald-300 font-semibold">
            <Eye className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Table Inspector Mode (Live Spectator)</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">— Watching live game play across all 4 seats</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 hidden md:inline">Click "Take Seat" on any open seat to join the game</span>
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="px-2.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 border border-slate-700 hover:border-slate-500"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Exit Inspector</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Table Felt Arena */}
      <main className="flex-1 w-full max-w-[96rem] mx-auto px-2 sm:px-4 py-1.5 sm:py-2 flex flex-col justify-between items-center gap-1.5 sm:gap-2">
        {/* North Seat (Opponent Top) */}
        <div className="w-full flex justify-center">
          <PlayerSeat
            player={playerNorth}
            isLocalPlayer={userSeatIndex === northSeat}
            isCurrentTurn={tableState.currentTurnSeat === northSeat}
            isLead={tableState.leadSeat === northSeat}
            isDealer={tableState.dealerSeat === northSeat}
            status={tableState.status}
            position="north"
            onTakeSeat={playerNorth.isAgent ? () => handleTakeSeat(northSeat) : undefined}
            winsCount={tableState.seatWins ? tableState.seatWins[northSeat] : 0}
          />
        </div>

        {/* Center Row: West Seat + Wide Center Trick Arena + East Seat */}
        <div className="w-full flex items-center justify-between gap-1.5 sm:gap-3">
          {/* West Seat (Opponent Left) */}
          <div className="w-36 sm:w-44 shrink-0 flex justify-start">
            <PlayerSeat
              player={playerWest}
              isLocalPlayer={userSeatIndex === westSeat}
              isCurrentTurn={tableState.currentTurnSeat === westSeat}
              isLead={tableState.leadSeat === westSeat}
              isDealer={tableState.dealerSeat === westSeat}
              status={tableState.status}
              position="west"
              onTakeSeat={playerWest.isAgent ? () => handleTakeSeat(westSeat) : undefined}
              winsCount={tableState.seatWins ? tableState.seatWins[westSeat] : 0}
            />
          </div>

          {/* Wide Center Arena */}
          <div className="flex-1 flex justify-center min-w-0 max-w-5xl px-0.5 sm:px-2">
            <TrickArena
              tableState={tableState}
              onStartDeal={handleStartDeal}
              canStartDeal={tableState.status === 'WAITING'}
            />
          </div>

          {/* East Seat (Opponent Right) */}
          <div className="w-36 sm:w-44 shrink-0 flex justify-end">
            <PlayerSeat
              player={playerEast}
              isLocalPlayer={userSeatIndex === eastSeat}
              isCurrentTurn={tableState.currentTurnSeat === eastSeat}
              isLead={tableState.leadSeat === eastSeat}
              isDealer={tableState.dealerSeat === eastSeat}
              status={tableState.status}
              position="east"
              onTakeSeat={playerEast.isAgent ? () => handleTakeSeat(eastSeat) : undefined}
              winsCount={tableState.seatWins ? tableState.seatWins[eastSeat] : 0}
            />
          </div>
        </div>

        {/* South Player Seat (Local Player Pod) */}
        <div className="w-full flex flex-col items-center gap-1.5 sm:gap-2">
          <PlayerSeat
            player={playerSouth}
            isLocalPlayer={userSeatIndex === mySeat}
            isCurrentTurn={tableState.currentTurnSeat === mySeat}
            isLead={tableState.leadSeat === mySeat}
            isDealer={tableState.dealerSeat === mySeat}
            status={tableState.status}
            position="south"
            onTakeSeat={playerSouth.isAgent ? () => handleTakeSeat(mySeat) : undefined}
            onLeaveSeat={userSeatIndex === mySeat ? handleLeaveSeat : undefined}
            canPlayNow={canPlayTrick}
            onPlayTrick={handlePlayTrick}
            winsCount={tableState.seatWins ? tableState.seatWins[mySeat] : 0}
          />

          {/* Arrangement Board when player is organizing their 13 cards */}
          {tableState.status === 'ARRANGING' && localHand && localHand.dealtCards && (
            <div className="w-full max-w-5xl animate-fade-in">
              <ArrangementBoard
                cards={localHand.dealtCards}
                isLockedIn={localHand.isReady}
                onLockIn={handleLockInArrangement}
                audioEnabled={audioEnabled}
              />
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <ScoreboardModal
        isOpen={showScoreboard}
        onClose={() => setShowScoreboard(false)}
        tableState={tableState}
        userSeatIndex={userSeatIndex}
      />

      <NetworkTestModal
        isOpen={showNetworkTest}
        onClose={() => setShowNetworkTest(false)}
      />

      <RulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
      />

      <AIModelModal
        isOpen={showAIModelModal}
        onClose={() => setShowAIModelModal(false)}
      />

      <GameWinModal
        tableState={tableState}
        onShuffleTable={handleShuffleTable}
        onCompleteGame={handleCompleteAndArchive}
        audioEnabled={audioEnabled}
      />
    </div>
  );
};
