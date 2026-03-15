/* eslint-disable react/jsx-no-constructed-context-values */
/* eslint-disable react/prop-types */
import React, { createContext, useState, useEffect } from 'react';
import { api } from '../api';

// Create the context
export const LogContext = createContext();

// Create a provider component
export function LogProvider({ children }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const unsubscribe = api.subscribeToLogs((level, message) => {
      setLogs((prevLogs) => [...prevLogs, message].slice(-1000));
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return (
    <LogContext.Provider value={{ logs, setLogs }}>
      {children}
    </LogContext.Provider>
  );
}
