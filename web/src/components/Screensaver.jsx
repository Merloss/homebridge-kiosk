import { round } from '../lib/device.js';
import { t } from '../lib/i18n.js';
import { roomLabel } from '../lib/rooms.js';

const MAX_READINGS = 4;

const hasClimate = ({ values }) =>
  typeof values.CurrentTemperature === 'number' || typeof values.CurrentRelativeHumidity === 'number';

function climateText({ room, values }) {
  const parts = [roomLabel(room)];
  if (typeof values.CurrentTemperature === 'number') parts.push(`${round(values.CurrentTemperature, 1)}°`);
  if (typeof values.CurrentRelativeHumidity === 'number') {
    parts.push(`· ${t('percent', { n: Math.round(values.CurrentRelativeHumidity) })}`);
  }
  return parts.join(' ');
}

export function Screensaver({ clock, devices, onWake }) {
  const readings = devices.filter(hasClimate).slice(0, MAX_READINGS);
  const onCount = devices.filter((device) => !device.readOnly && device.active).length;

  return (
    <div className="screensaver visible" onPointerDown={onWake}>
      <div className="ss-time">{clock.time}</div>
      <div className="ss-date">{clock.date}</div>
      <div className="ss-sensors">
        {readings.map((device) => (
          <span key={device.id}>{climateText(device)}</span>
        ))}
        <span>{t('devicesOn', { n: onCount })}</span>
      </div>
      <div className="ss-hint">{t('wakeHint')}</div>
    </div>
  );
}
