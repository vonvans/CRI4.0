/* eslint-disable react/jsx-no-constructed-context-values */
/* eslint-disable react/prop-types */
import React, { createContext, useState } from 'react';

// Create the context
export const LogContext = createContext();

// Create a provider component
export function LogProvider({ children }) {
  const [logs, setLogs] = useState([]);

  return (
    <LogContext.Provider value={{ logs, setLogs }}>
      {children}
    </LogContext.Provider>
  );
}
