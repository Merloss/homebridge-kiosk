import { MockClient } from './mock.js';
import { normalizeAll } from './normalize.js';

export async function createDemoState({ title }) {
  const mock = new MockClient();
  const { devices, rooms } = normalizeAll(await mock.getAccessories(), await mock.getLayout());

  return {
    devices,
    rooms,
    scenes: [
      { id: 'night', name: 'Good night', icon: '🌙' },
      { id: 'movie', name: 'Movie', icon: '🎬' },
      { id: 'all-off', name: 'All off', icon: '⏻' },
    ],
    connected: true,
    config: { title, locale: '', theme: 'auto', screensaverAfter: 0, mock: true },
  };
}
