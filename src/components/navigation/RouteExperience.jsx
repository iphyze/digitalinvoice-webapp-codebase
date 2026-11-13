import { useEffect, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './RouteExperience.module.css';

/**
 * All layouts share the browser's document scroller. Reset it when a new page
 * opens, but preserve position for same-page filters, anchors and query edits.
 * Show immediate feedback while an internal navigation is being processed;
 * Suspense/PageLoader takes over if the destination module is still loading.
 */
export default function RouteExperience() {
  const location = useLocation();
  const [pending, setPending] = useState(false);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }, [location.pathname]);

  useEffect(() => { setPending(false); }, [location.key]);

  useEffect(() => {
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      setPending(true);
    };
    const onPopState = () => setPending(true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  return pending ? (
    <div className={styles.feedback} role="status" aria-live="polite" aria-label="Opening page">
      <span className={styles.progress} aria-hidden="true" />
      <span className={styles.message}>Opening page…</span>
    </div>
  ) : null;
}
