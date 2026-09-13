import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel'];

export function useScreensaver(seconds, onSleep) {
  const [asleep, setAsleep] = useState(false);
  const timer = useRef();
  const onSleepRef = useRef(onSleep);
  onSleepRef.current = onSleep;

  const wake = useCallback(() => {
    setAsleep(false);
    clearTimeout(timer.current);
    if (seconds <= 0) return;
    timer.current = setTimeout(() => {
      setAsleep(true);
      onSleepRef.current?.();
    }, seconds * 1000);
  }, [seconds]);

  useEffect(() => {
    wake();
    for (const name of ACTIVITY_EVENTS) addEventListener(name, wake, { passive: true });
    return () => {
      for (const name of ACTIVITY_EVENTS) removeEventListener(name, wake);
      clearTimeout(timer.current);
    };
  }, [wake]);

  return { asleep, wake };
}
