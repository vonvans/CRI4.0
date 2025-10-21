/* eslint-disable react/jsx-no-constructed-context-values */
/* eslint-disable react/prop-types */
import React, { createContext, useState, useEffect } from 'react';

// Create the context
export const LogContext = createContext();

// Create a provider component
export function LogProvider({ children }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('log-message', (log) => {
      setLogs((prevLogs) => [...prevLogs, log.message].slice(-1000));
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
