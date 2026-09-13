import { useEffect, useRef, useState } from 'react';
import { subscribeToast } from '../lib/toast.js';

const VISIBLE_MS = 2600;

export function useToast() {
  const [message, setMessage] = useState('');
  const timer = useRef();

  useEffect(() => {
    const unsubscribe = subscribeToast((next) => {
      setMessage(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(''), VISIBLE_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer.current);
    };
  }, []);

  return message;
}
