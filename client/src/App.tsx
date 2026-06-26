import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { I18nProvider } from './context/I18nContext';
import Home from './pages/Home';
import PassAndPlay from './pages/PassAndPlay';
import LANLobby from './pages/LANLobby';
import LANGame from './pages/LANGame';
import JoinGame from './pages/JoinGame';
import { Capacitor } from '@capacitor/core';
import { NodeJS } from '@choreruiz/capacitor-node-js';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';

function DeepLinkHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    if ((window as any).electronAPI && (window as any).electronAPI.onDeepLink) {
      (window as any).electronAPI.onDeepLink((url: string) => {
        try {
          new URL(url); // validate url format
          // e.g. codenames://lan-lobby?wan=true&room=123 -> pathname: //lan-lobby (or empty on some systems), hostname: lan-lobby
          // We can reliably extract everything after "codenames://"
          const pathAndSearch = url.replace(/^codenames:\/\/\/?/i, '/');
          navigate(pathAndSearch);
        } catch (e) {
          console.error('Invalid deep link URL', url, e);
        }
      });
    }
  }, [navigate]);
  return null;
}

function App() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Listen for bridge.channel.send('server-port', { port }) from Node.js server
      NodeJS.addListener('server-port', (event: any) => {
        const args = event?.args;
        const port = Array.isArray(args) ? args[0]?.port : args?.port ?? event?.port;
        if (port) {
          (window as any).SERVER_PORT = port;
          console.log('[Bridge IPC] Server port received:', port);
        }
      });

      // START IN MANUAL MODE — lets us pass env before the engine initializes.
      NodeJS.start({
        args: [],
        env: {
          PORT: '3000'
        }
      });

      // HTTP poll fallback — kicks in if bridge IPC doesn't fire
      // Server defaults to port 3000 (no PORT env in auto mode)
      const pollPort = async () => {
        for (const p of [3000, 3001, 3002, 3003, 3004, 3005]) {
          try {
            const res = await fetch(`http://127.0.0.1:${p}/api/port`, { signal: AbortSignal.timeout(800) });
            if (res.ok) {
              const data = await res.json();
              if (data.port && data.port > 0) {
                (window as any).SERVER_PORT = data.port;
                console.log('[HTTP Poll] Server found on port:', data.port);
                return;
              }
            }
          } catch (_) { /* port not open yet */ }
        }
        // Server not found yet, retry
        setTimeout(pollPort, 1000);
      };

      // Give the server 3 seconds to start, then poll
      const pollTimer = setTimeout(() => {
        if (!(window as any).SERVER_PORT) {
          pollPort();
        }
      }, 3000);

      return () => clearTimeout(pollTimer);
    }
  }, []);

  return (
    <I18nProvider>
      <GameProvider>
        <Router>
          <DeepLinkHandler />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pass-and-play" element={<PassAndPlay />} />
            <Route path="/lan-lobby" element={<LANLobby />} />
            <Route path="/join-game" element={<JoinGame />} />
            <Route path="/lan-game" element={<LANGame />} />
          </Routes>
        </Router>
        <Toaster position="top-center" />
      </GameProvider>
    </I18nProvider>
  );
}

export default App;
