import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import type { DashboardAlertsData } from '../types';

interface UseDashboardAlertsResult {
  data: DashboardAlertsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboardAlerts(): UseDashboardAlertsResult {
  const [data, setData] = useState<DashboardAlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<DashboardAlertsData>(
        '/dashboard/alerts?expiringWindowDays=14&inactiveThresholdDays=30&limitPerCategory=20',
      );
      setData(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Une erreur inattendue s\'est produite.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  return { data, loading, error, refetch: fetchAlerts };
}
