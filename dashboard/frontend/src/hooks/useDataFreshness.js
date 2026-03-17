import { useEffect, useRef } from 'react';
import { showToast } from '../Toast';
import { invalidate } from '../utils/dataCache';
import { API_BASE } from '../config/api';

/**
 * Polls GET /snag-assignments/last-updated every intervalMs.
 * When a change is detected, shows an action toast that refreshes data and preserves scroll.
 *
 * @param {Function} onRefresh — called to re-fetch page data
 * @param {number} intervalMs — polling interval (default 45s)
 */
export function useDataFreshness(onRefresh, intervalMs = 45000) {
  const baselineRef = useRef(null);
  const toastShownRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/snag-assignments/last-updated`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { last_updated } = await res.json();
        if (!last_updated) return;

        if (baselineRef.current === null) {
          baselineRef.current = last_updated;
          return;
        }

        if (last_updated !== baselineRef.current && !toastShownRef.current) {
          toastShownRef.current = true;
          showToast('New updates available — tap to refresh', 'info', 0, () => {
            const scrollY = window.scrollY;
            invalidate(''); // bust all cache
            onRefresh();
            requestAnimationFrame(() => {
              window.scrollTo(0, scrollY);
            });
            baselineRef.current = last_updated;
            toastShownRef.current = false;
          });
        }
      } catch {
        // silently ignore poll errors
      }
    };

    // Initial poll after a short delay
    const initialTimeout = setTimeout(poll, 3000);
    const interval = setInterval(poll, intervalMs);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [onRefresh, intervalMs]);
}
