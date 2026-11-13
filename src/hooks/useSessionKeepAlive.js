import { useEffect, useRef } from 'react';
import useAuthStore from '../stores/useAuthStore';

const USER_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
const HEARTBEAT_INTERVAL_MS = 60_000;
const MINIMUM_PING_GAP_MS = 4 * 60_000;
const ACTIVE_USER_WINDOW_MS = 10 * 60_000;

const useSessionKeepAlive = () => {
  const status = useAuthStore((state) => state.status);
  const refreshSessionState = useAuthStore((state) => state.refreshSessionState);
  const lastUserActivityRef = useRef(Date.now());
  const lastPingRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated') return undefined;

    const markActivity = () => {
      lastUserActivityRef.current = Date.now();
    };

    const canPing = () => (
      // MFA confirmation revokes the session; polling during the one-time
      // recovery-code display could destroy codes before they are saved.
      window.location.pathname !== '/security/mfa'
      // MFA enrolment/regeneration shows single-use codes inside Profile.
      // The server has already revoked the session after confirmation, so a
      // heartbeat here would force navigation and destroy those codes.
      && document.querySelector('[data-mfa-recovery-codes]') === null
      && (typeof document === 'undefined'
      || document.visibilityState === 'visible')
    ) && Date.now() - lastUserActivityRef.current <= ACTIVE_USER_WINDOW_MS
      && Date.now() - lastPingRef.current >= MINIMUM_PING_GAP_MS
      && !refreshingRef.current;

    const ping = async () => {
      if (!canPing()) return;

      refreshingRef.current = true;
      lastPingRef.current = Date.now();
      try {
        await refreshSessionState();
      } catch {
        // The API interceptor handles session refresh failure and auto sign-out.
      } finally {
        refreshingRef.current = false;
      }
    };

    USER_ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, markActivity, { passive: true });
    });

    const handleFocusOrVisibility = () => {
      markActivity();
      void ping();
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    const interval = window.setInterval(() => {
      void ping();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      USER_ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, markActivity);
      });
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, [refreshSessionState, status]);
};

export default useSessionKeepAlive;
