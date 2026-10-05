/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store, useAppDispatch } from './store';
import { TableLayout } from './components/TableLayout';

function GameRoot() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Initialize Socket.io connection & real-time sync
    dispatch({ type: 'socket/init' });
  }, [dispatch]);

  return <TableLayout />;
}

export default function App() {
  return (
    <Provider store={store}>
      <GameRoot />
    </Provider>
  );
}
