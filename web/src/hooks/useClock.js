import { useEffect, useState } from 'react';

const TICK_MS = 10_000;

function readClock(locale) {
  const now = new Date();
  return {
    time: now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    date: now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

export function useClock(locale) {
  const [clock, setClock] = useState(() => readClock(locale));

  useEffect(() => {
    setClock(readClock(locale));
    const timer = setInterval(() => setClock(readClock(locale)), TICK_MS);
    return () => clearInterval(timer);
  }, [locale]);

  return clock;
}
