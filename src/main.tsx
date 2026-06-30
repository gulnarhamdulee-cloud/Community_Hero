import React, {StrictMode, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './features/auth/AuthProvider.tsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.tsx';
import { NotificationProvider } from './features/notifications/NotificationProvider.tsx';
import './index.css';
import Lenis from '@studio-freight/lenis';

function LenisScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Lenis with smooth wheel and touch controls
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // smooth easeOutExpo
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      smoothTouch: true, // Enabled as requested
    } as any);

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    // Expose Lenis globally to allow special child sections/modals to interact if needed
    (window as any).lenis = lenis;

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      (window as any).lenis = null;
    };
  }, []);

  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <LenisScrollProvider>
          <App />
        </LenisScrollProvider>
      </NotificationProvider>
    </AuthProvider>
  </StrictMode>,
);
