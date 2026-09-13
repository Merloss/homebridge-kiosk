import { useCallback, useSyncExternalStore } from 'react';
import { getDevice, getDeviceVersion, getState, getVersion, subscribe, subscribeDevice } from '../lib/store.js';

export function useStoreState() {
  useSyncExternalStore(subscribe, getVersion);
  return getState();
}

export function useDevice(id) {
  const subscribeToDevice = useCallback((listener) => subscribeDevice(id, listener), [id]);
  useSyncExternalStore(subscribeToDevice, () => getDeviceVersion(id));
  return getDevice(id);
}
