import { useCallback, useEffect, useState } from 'react';

export default function useInventory() {
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setState('loading'); setError('');
    if (!window.smartWater?.listInventoryItems) { setState('error'); setError('Inventory is available in the SmartWater desktop application.'); return false; }
    try {
      const result = await window.smartWater.listInventoryItems();
      if (!result?.ok || !Array.isArray(result.data)) { setState('error'); setError(result?.error || 'Could not load inventory.'); return false; }
      setItems(result.data); setState('ready'); return true;
    } catch { setState('error'); setError('Could not load inventory. Please try again.'); return false; }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { items, setItems, state, error, reload };
}
