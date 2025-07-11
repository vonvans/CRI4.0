/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable import/order */
/* eslint-disable prettier/prettier */


import { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Outlet} from 'react-router-dom';
import "tailwindcss/tailwind.css";
import Home from "./pages/Home";
import Topology from "./pages/Topology";
import Attack from "./pages/Attack";
import Logs from "./pages/Logs";
import { Footer } from './components/Footer';
import {NextUIProvider} from '@nextui-org/react';
import { AppNavbar } from './components/Navbar/AppNavbar';
import { NotificationProvider } from './contexts/NotificationContext';
import Settings from './pages/Settings';
import { LogProvider } from './contexts/LogContext';
import Report from './pages/Report';

export default function App() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => {
    const darkMode = localStorage.getItem("darkMode");
    return darkMode ? JSON.parse(darkMode) : false;
  });

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  return (
    <NextUIProvider navigate={navigate}>
       <main className={`${darkMode ? 'dark' : 'light'} text-foreground bg-background w-full flex min-h-screen`}>
          <div className="h-full flex-1">
            <div className="flex h-full min-h-screen flex-col justify-between">
              <NotificationProvider>
                <LogProvider>
                  <AppNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
                  <div className="min-h-[calc(100vh-4rem)]">
                    <Routes>
                      <Route path="/" element={<Outlet />}>
                        <Route index element={<Home />} />
                        <Route path="topology" element={<Topology />} />
                        <Route path="attack" element={<Attack />} />
                        <Route path="report" element={<Report />} />
                        <Route path="logs" element={<Logs />} />
                        <Route path="settings" element={<Settings />} />
                      </Route>
                    </Routes>
                  </div>
                  <Footer />
                </LogProvider>
              </NotificationProvider>
            </div>
          </div>
        </main>
    </NextUIProvider>
  );
}
