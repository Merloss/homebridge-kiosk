import { useEffect, useSyncExternalStore } from 'react';
import { getLang, subscribeLang } from '../lib/i18n.js';
import { notifyAll } from '../lib/store.js';

export function useLanguage() {
  useEffect(() => subscribeLang(notifyAll), []);
  return useSyncExternalStore(subscribeLang, getLang);
}
