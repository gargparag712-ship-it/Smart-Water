import { useCallback, useEffect, useState } from 'react';

export default function useMaintenance() {
  const [records, setRecords] = useState([]); const [assets, setAssets] = useState([]); const [state, setState] = useState('loading'); const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setState('loading'); setError('');
    if (!window.smartWater?.listMaintenanceRecords || !window.smartWater?.listMaintenanceAssets) { setState('error'); setError('Maintenance records are available in the SmartWater desktop application.'); return false; }
    try {
      const [workOrders, assetList] = await Promise.all([window.smartWater.listMaintenanceRecords({}), window.smartWater.listMaintenanceAssets()]);
      if (!workOrders?.ok || !Array.isArray(workOrders.data) || !assetList?.ok || !Array.isArray(assetList.data)) throw new Error(workOrders?.error || assetList?.error || 'Could not load maintenance records.');
      setRecords(workOrders.data); setAssets(assetList.data); setState('ready'); return true;
    } catch { setState('error'); setError('Could not load maintenance records. Please try again.'); return false; }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { records, setRecords, assets, state, error, reload };
}
