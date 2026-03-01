import { useState, useEffect } from 'react';

export function useServerTime() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const syncTime = async () => {
      const start = Date.now();
      try {
        const res = await fetch('/api/time');
        const data = await res.json();
        const end = Date.now();
        const latency = (end - start) / 2;
        const serverTime = data.time + latency;
        setOffset(serverTime - end);
      } catch (e) {
        console.error('Time sync failed', e);
      }
    };

    syncTime();
    // Re-sync every minute
    const interval = setInterval(syncTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const now = () => Date.now() + offset;

  return { now, offset };
}
