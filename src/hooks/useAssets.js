import { useCallback, useEffect, useState } from 'react';

export default function useAssets() {
  const [assets, setAssets] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setState('loading');
    setError('');
    if (!window.smartWater?.listAssets) {
      setState('error');
      setError('Asset records are available in the SmartWater desktop application.');
      return false;
    }
    try {
      const result = await window.smartWater.listAssets();
      if (!result?.ok || !Array.isArray(result.data)) {
        setState('error');
        setError(result?.error || 'SmartWater could not load asset records.');
        return false;
      }
      setAssets(result.data);
      setState('ready');
      return true;
    } catch {
      setState('error');
      setError('SmartWater could not load asset records. Please try again.');
      return false;
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { assets, setAssets, state, error, setError, reload };
}
