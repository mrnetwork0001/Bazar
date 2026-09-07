'use client';
import { useEffect, useState } from 'react';

export default function SmokePage() {
  const [out, setOut] = useState('idle');
  useEffect(() => {
    (async () => {
      try {
        const sdk = await import('@altananetwork/sdk');
        setOut(`SMOKE_OK exports=${Object.keys(sdk).length} keyStore=${sdk.BNB.keyStore} fns=${typeof sdk.createClient},${typeof sdk.hireErc8183Agent},${typeof sdk.serializeSession}`);
      } catch (e) {
        setOut(`SMOKE_FAILED: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  }, []);
  return <main className="container-x py-20"><pre id="smoke">{out}</pre></main>;
}
