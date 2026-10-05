import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setSimulateLagMs, clearLogs } from '../store/networkSlice';
import {
  Activity,
  Wifi,
  WifiOff,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';

interface NetworkTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkTestModal: React.FC<NetworkTestModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch();
  const { isConnected, isReconnecting, connectionError, lastSyncTimestamp } = useAppSelector(
    (state) => state.table
  );
  const { simulateLagMs, logs } = useAppSelector((state) => state.network);

  const [unitTestResults, setUnitTestResults] = useState<{
    passed: boolean;
    results: { name: string; success: boolean; details?: string }[];
  } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSimulatingReconnect, setIsSimulatingReconnect] = useState(false);

  if (!isOpen) return null;

  const handleTestReconnect = () => {
    setIsSimulatingReconnect(true);
    // Disconnect socket
    dispatch({ type: 'socket/simulateDisconnect' });

    // Reconnect after 3 seconds to test state recovery
    setTimeout(() => {
      dispatch({ type: 'socket/simulateDisconnect' });
      setIsSimulatingReconnect(false);
    }, 3000);
  };

  const handleRunUnitTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/test/run-unit-tests', { method: 'POST' });
      const data = await res.json();
      setUnitTestResults(data);
    } catch (err: any) {
      setUnitTestResults({
        passed: false,
        results: [{ name: 'Failed to communicate with test runner', success: false, details: err.message }],
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-2xl max-h-[85vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100">Network & State Recovery Test Suite</h2>
              <p className="text-xs text-slate-400">
                Automated tests for network drops, state recovery, and optimistic UI synchronization.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Live Status Indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Socket Status</span>
              <div className="flex items-center gap-1.5 mt-1">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400">Online (Synced)</span>
                  </>
                ) : isReconnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                    <span className="text-xs font-bold text-amber-400">Reconnecting</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold text-rose-400">Offline</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Artificial Lag</span>
              <div className="flex items-center gap-1.5 mt-1 font-mono text-xs font-bold text-amber-300">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{simulateLagMs} ms</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Server Persistence</span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-sky-400">
                <Server className="w-4 h-4" />
                <span>Snapshots Active</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Last State Sync</span>
              <div className="mt-1 font-mono text-xs text-slate-300">
                {lastSyncTimestamp > 0 ? `${Math.round((Date.now() - lastSyncTimestamp) / 1000)}s ago` : 'Waiting'}
              </div>
            </div>
          </div>

          {/* Test Action Controls */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Network Failure Simulations
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Simulate Socket Drop & Auto-Recovery */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Simulate Reconnection & Grace Period</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Drops socket for 3 seconds. The server activates agent takeover to avoid table stalls, then reconciles your hand on reconnect.
                  </p>
                </div>
                <button
                  onClick={handleTestReconnect}
                  disabled={isSimulatingReconnect}
                  className="mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-bold text-white transition"
                >
                  {isSimulatingReconnect ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Simulating Drop (3s)...</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5" />
                      <span>Trigger Socket Disconnect</span>
                    </>
                  )}
                </button>
              </div>

              {/* Jitter / Latency Simulation */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200">Network Jitter Delay</h4>
                    <span className="font-mono text-xs text-amber-400 font-bold">{simulateLagMs}ms</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Adds artificial latency to outbound socket packets to test optimistic UI updates and server reconciliation.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1500"
                    step="100"
                    value={simulateLagMs}
                    onChange={(e) => dispatch(setSimulateLagMs(Number(e.target.value)))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  {simulateLagMs > 0 && (
                    <button
                      onClick={() => dispatch(setSimulateLagMs(0))}
                      className="text-[10px] text-slate-400 hover:text-white underline shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Run Core Hazari Rules Unit Tests */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Automated Core Rules Test Suite</h4>
                  <p className="text-[11px] text-slate-400">
                    Runs unit tests on deck generation, 360 deck points, combination hierarchies, tie-breaking, and 1000-point win conditions.
                  </p>
                </div>
                <button
                  onClick={handleRunUnitTests}
                  disabled={isRunningTests}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white transition shadow"
                >
                  {isRunningTests ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>Run Unit Tests</span>
                </button>
              </div>

              {unitTestResults && (
                <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800 font-bold">
                    <span className={unitTestResults.passed ? 'text-emerald-400' : 'text-rose-400'}>
                      {unitTestResults.passed ? '✓ All Core Tests Passed' : '✗ Tests Reported Failures'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {unitTestResults.results.filter((r) => r.success).length}/{unitTestResults.results.length} passed
                    </span>
                  </div>
                  {unitTestResults.results.map((res, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      {res.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <span className={res.success ? 'text-slate-300' : 'text-rose-300 font-semibold'}>
                        {res.name}
                        {res.details && <span className="text-slate-500 ml-1">({res.details})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Network Event Log Stream */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Network & Socket Event Logs ({logs.length})
              </h3>
              <button
                onClick={() => dispatch(clearLogs())}
                className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto border border-slate-800">
              {logs.length === 0 ? (
                <span className="text-slate-600 italic">No logs recorded yet.</span>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2">
                    <span className="text-slate-500 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span
                      className={`
                        ${log.level === 'success' ? 'text-emerald-400' : ''}
                        ${log.level === 'warn' ? 'text-amber-400' : ''}
                        ${log.level === 'error' ? 'text-rose-400' : ''}
                        ${log.level === 'info' ? 'text-slate-300' : ''}
                      `}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
