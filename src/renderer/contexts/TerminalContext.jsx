import React, { createContext, useState } from 'react';

// Create the context
export const TerminalContext = createContext();

// Create a provider component
export function TerminalProvider({ children }) {
    const [activeTerminals, setActiveTerminals] = useState([]);

    return (
        <TerminalContext.Provider value={{ activeTerminals, setActiveTerminals }}>
            {children}
        </TerminalContext.Provider>
    );
}
