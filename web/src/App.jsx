import { useCallback, useState } from 'react';
import { EmptyState } from './components/EmptyState.jsx';
import { ErrorBar } from './components/ErrorBar.jsx';
import { LoadingGrid } from './components/LoadingGrid.jsx';
import { ALL_ROOMS, RoomTabs } from './components/RoomTabs.jsx';
import { Scenes } from './components/Scenes.jsx';
import { Screensaver } from './components/Screensaver.jsx';
import { Sheet } from './components/sheet/Sheet.jsx';
import { Tile } from './components/Tile.jsx';
import { Toast } from './components/Toast.jsx';
import { Toolbar } from './components/Toolbar.jsx';
import { TopBar } from './components/TopBar.jsx';
import { useClock } from './hooks/useClock.js';
import { useLanguage } from './hooks/useLanguage.js';
import { useScreensaver } from './hooks/useScreensaver.js';
import { useStoreState } from './hooks/useStore.js';
import { useToast } from './hooks/useToast.js';
import { localeTag } from './lib/i18n.js';
import { readSetting, writeSetting } from './lib/storage.js';

const VIEW_FILTERS = {
  grouped: (device) => !device.isBridge && device.group.primary,
  all: (device) => !device.isBridge,
  debug: () => true,
};

function isDebugEnabled() {
  const flag = new URLSearchParams(location.search).get('debug');
  if (flag === '0' || flag === '1') writeSetting('kiosk.debug', flag);
  return readSetting('kiosk.debug') === '1';
}

export function App({ devTools }) {
  const kiosk = useStoreState();
  useLanguage();

  const [debug] = useState(isDebugEnabled);
  const [view, setView] = useState(() => {
    const saved = readSetting('kiosk.view', 'grouped');
    return saved in VIEW_FILTERS && (saved !== 'debug' || debug) ? saved : 'grouped';
  });
  const [room, setRoom] = useState(ALL_ROOMS);
  const [sheetId, setSheetId] = useState(null);
  const closeSheet = useCallback(() => setSheetId(null), []);

  const clock = useClock(kiosk.config.locale || localeTag());
  const { asleep, wake } = useScreensaver(Number(kiosk.config.screensaverAfter) || 0, closeSheet);
  const toastMessage = useToast();

  const selectView = (next) => {
    setView(next);
    writeSetting('kiosk.view', next);
  };

  const shown = kiosk.devices.filter(VIEW_FILTERS[view]);
  const rooms = kiosk.rooms.filter((name) => shown.some((device) => device.room === name));
  const activeRoom = rooms.includes(room) ? room : ALL_ROOMS;
  const visible = activeRoom === ALL_ROOMS ? shown : shown.filter((device) => device.room === activeRoom);
  const onCount = shown.filter((device) => !device.readOnly && device.active).length;

  return (
    <div id="app">
      <TopBar
        clock={clock}
        title={kiosk.config.title}
        ready={kiosk.ready}
        connected={kiosk.connected}
        mock={kiosk.config.mock}
        onCount={onCount}
      />
      <ErrorBar ready={kiosk.ready} connected={kiosk.connected} error={kiosk.error} updatedAt={kiosk.updatedAt} />
      <Toolbar views={debug ? ['grouped', 'all', 'debug'] : ['grouped', 'all']} view={view} onSelectView={selectView} />
      <RoomTabs rooms={rooms} active={activeRoom} onSelect={setRoom} />

      <main className="content">
        <Scenes scenes={kiosk.scenes} />
        {!kiosk.ready && visible.length === 0 && <LoadingGrid />}
        <div className="grid">
          {visible.map((device) => (
            <Tile
              key={device.id}
              id={device.id}
              label={view === 'grouped' && device.group.size > 1 ? device.group.name : null}
              onOpenSheet={setSheetId}
              onWake={wake}
            />
          ))}
        </div>
        {kiosk.ready && visible.length === 0 && <EmptyState />}
      </main>

      {sheetId && <Sheet id={sheetId} onClose={closeSheet} />}
      {asleep && <Screensaver clock={clock} devices={kiosk.devices} onWake={wake} />}
      <Toast message={toastMessage} />
      {devTools?.({ devices: kiosk.devices, openSheet: setSheetId, sheetId })}
    </div>
  );
}
