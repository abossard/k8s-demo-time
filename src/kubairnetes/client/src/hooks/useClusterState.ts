import { useState, useCallback, useEffect, useRef } from 'react';
import { getClusterState } from '../lib/api';
import type { ClusterState } from '../lib/types';

export function useClusterState() {
  const [state, setState] = useState<ClusterState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [lastChanged, setLastChanged] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async (namespace?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getClusterState(namespace);
      setState(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startWatching = useCallback((namespace?: string) => {
    // Close existing connection
    eventSourceRef.current?.close();

    const params = new URLSearchParams();
    if (namespace) params.set('namespace', namespace);
    params.set('interval', '5000');

    const es = new EventSource(`/api/cluster/watch?${params}`);
    eventSourceRef.current = es;
    setIsWatching(true);
    setError(null);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setError(data.error);
          return;
        }
        setState(data);
        if (data.changed) {
          setLastChanged(new Date().toISOString());
        }
      } catch {
        // Skip bad events
      }
    };

    es.onerror = () => {
      setIsWatching(false);
      setError('Watch connection lost. Click refresh to reconnect.');
      es.close();
    };
  }, []);

  const stopWatching = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsWatching(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { eventSourceRef.current?.close(); };
  }, []);

  return {
    clusterState: state,
    isLoading,
    error,
    refresh,
    isWatching,
    startWatching,
    stopWatching,
    lastChanged,
  };
}
