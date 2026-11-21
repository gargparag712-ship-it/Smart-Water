import { useEffect, useState } from 'react';
export default function useFinanceSummary() {
  const [summary, setSummary] = useState(null); const [state, setState] = useState('loading');
  useEffect(() => {
    let active = true;
    async function load() {
      try { if (!window.smartWater?.getFinanceSummary) throw new Error('Unavailable'); const result = await window.smartWater.getFinanceSummary(); if (!result?.ok) throw new Error('Unavailable'); if (active) { setSummary(result.data); setState('ready'); } }
      catch { if (active) { setSummary(null); setState('error'); } }
    }
    load(); return () => { active = false; };
  }, []);
  return { summary, state };
}
