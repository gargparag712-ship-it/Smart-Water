import { useEffect, useState } from 'react';
export default function useMaintenanceOverview() {
  const [summary, setSummary] = useState(null); const [records, setRecords] = useState([]); const [state, setState] = useState('loading');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!window.smartWater?.getMaintenanceSummary || !window.smartWater?.listMaintenanceRecords) throw new Error('Unavailable');
        const [summaryResult, recordsResult] = await Promise.all([window.smartWater.getMaintenanceSummary(), window.smartWater.listMaintenanceRecords({})]);
        if (!summaryResult?.ok || !recordsResult?.ok) throw new Error('Unavailable');
        if (active) { setSummary(summaryResult.data); setRecords(recordsResult.data); setState('ready'); }
      } catch { if (active) { setSummary(null); setRecords([]); setState('error'); } }
    }
    load(); return () => { active = false; };
  }, []);
  return { summary, records, state };
}
