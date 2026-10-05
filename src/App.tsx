/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Provider } from 'react-redux';
import { store, useAppDispatch } from './store';
import { setUserCredentials, setTableId } from './store/networkSlice';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { getUserProfile, UserProfile, createOrUpdateUserProfile } from './firebase/authService';
import { AuthScreen } from './components/AuthScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { TableLayout } from './components/TableLayout';
import { InviteNotificationToast } from './components/InviteNotificationToast';

function AppRouter() {
  const dispatch = useAppDispatch();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'auth' | 'dashboard' | 'game'>('auth');
  const [activeTableId, setActiveTableId] = useState<string>('main');
  const [activeTableName, setActiveTableName] = useState<string>('Hazari High Roller Table');
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let profile = await getUserProfile(firebaseUser.uid);
        if (!profile) {
          profile = await createOrUpdateUserProfile(firebaseUser);
        }
        setCurrentUser(profile);
        dispatch(
          setUserCredentials({
            userId: profile.uid,
            userName: profile.username,
          })
        );
        // If guest or newly authenticated, default to dashboard
        setCurrentScreen((prev) => (prev === 'game' ? 'game' : 'dashboard'));
      } else {
        setCurrentUser(null);
        setCurrentScreen('auth');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [dispatch]);

  const handleAuthenticated = (profile: UserProfile, directToGame?: boolean) => {
    setCurrentUser(profile);
    dispatch(
      setUserCredentials({
        userId: profile.uid,
        userName: profile.username,
      })
    );

    if (directToGame) {
      // Flow 1: Play as guest directly opens game table
      setActiveTableId('main');
      setActiveTableName('Hazari High Roller Table');
      dispatch(setTableId('main'));
      dispatch({ type: 'socket/init' });
      dispatch({
        type: 'socket/switchTable',
        payload: {
          tableId: 'main',
          tableName: 'Hazari High Roller Table',
          userId: profile.uid,
          userName: profile.username,
        },
      });
      setCurrentScreen('game');
    } else {
      setCurrentScreen('dashboard');
    }
  };

  const handleJoinTable = (tableId: string, tableName: string) => {
    setActiveTableId(tableId);
    setActiveTableName(tableName);
    dispatch(setTableId(tableId));
    dispatch({ type: 'socket/init' });
    dispatch({
      type: 'socket/switchTable',
      payload: {
        tableId,
        tableName,
        userId: currentUser?.uid,
        userName: currentUser?.username,
      },
    });
    setCurrentScreen('game');
  };

  const handleBackToDashboard = () => {
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('auth');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Loading Hazari Masters...</p>
      </div>
    );
  }

  return (
    <>
      {currentScreen === 'auth' && (
        <AuthScreen onAuthenticated={handleAuthenticated} />
      )}

      {currentScreen === 'dashboard' && currentUser && (
        <DashboardScreen
          currentUser={currentUser}
          onJoinTable={handleJoinTable}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === 'game' && (
        <TableLayout onBackToDashboard={handleBackToDashboard} />
      )}

      {/* Global Invitation Toast when online friends invite user */}
      {currentUser && (
        <InviteNotificationToast
          currentUser={currentUser}
          onAcceptInvite={handleJoinTable}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppRouter />
    </Provider>
  );
}
