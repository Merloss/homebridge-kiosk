import { t } from '../lib/i18n.js';
import { roomLabel } from '../lib/rooms.js';

export const ALL_ROOMS = '__all__';

export function RoomTabs({ rooms, active, onSelect }) {
  const select = (room) => {
    onSelect(room);
    document.querySelector('.content')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="rooms" aria-label={t('roomsLabel')}>
      {[ALL_ROOMS, ...rooms].map((room) => (
        <button key={room} className={`room-tab${room === active ? ' active' : ''}`} onClick={() => select(room)}>
          {room === ALL_ROOMS ? t('allRooms') : roomLabel(room)}
        </button>
      ))}
    </nav>
  );
}
