import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';

export default function ConnectionStatus() {
  const [state, setState] = useState('connecting');
  useEffect(() => {
    let active = true;
    if (!window.smartWater?.checkHealth) {
      setState('offline');
      return () => { active = false; };
    }
    window.smartWater.checkHealth()
      .then((result) => { if (active) setState(result.ok ? 'online' : 'offline'); })
      .catch(() => { if (active) setState('offline'); });
    return () => { active = false; };
  }, []);

  const Icon = state === 'online' ? CircleCheck : state === 'offline' ? CircleX : LoaderCircle;
  const label = state === 'online' ? 'Desktop service connected' : state === 'offline' ? 'Desktop service unavailable' : 'Checking desktop service';
  return <div className={`connection-status ${state}`} role="status"><Icon size={15} className={state === 'connecting' ? 'spin' : ''} aria-hidden="true" /><span>{label}</span></div>;
}
