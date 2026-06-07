'use client';
import { useEffect, useState } from 'react';

export default function TestSession() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    fetch('/api/test-session').then(r => r.json()).then(setSession);
  }, []);
  return <pre>{JSON.stringify(session, null, 2)}</pre>;
}