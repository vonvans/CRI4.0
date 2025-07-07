/* eslint-disable react/jsx-no-constructed-context-values */
/* eslint-disable react/prop-types */
import React, { createContext, useState } from 'react';

// Create the context
export const NotificationContext = createContext();

// Create a provider component
export function NotificationProvider({ children }) {
  const [attackLoaded, setAttackLoaded] = useState(null);

  return (
    <NotificationContext.Provider value={{ attackLoaded, setAttackLoaded }}>
      {children}
    </NotificationContext.Provider>
  );
}
