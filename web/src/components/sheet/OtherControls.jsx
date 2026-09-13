import { useMemo } from 'react';
import { useDevice } from '../../hooks/useStore.js';
import { statusText } from '../../lib/device.js';
import { haptic } from '../../lib/haptics.js';
import { t } from '../../lib/i18n.js';
import { getState, toggle } from '../../lib/store.js';

function OtherControl({ id }) {
  const device = useDevice(id);
  if (!device) return null;

  return (
    <div className="subrow" data-sub-id={device.id}>
      <span className="subrow-name">{device.name}</span>
      {device.primary && !device.readOnly ? (
        <button
          className={`subrow-switch${device.active ? ' on' : ''}`}
          data-act="sub-toggle"
          aria-pressed={device.active}
          aria-label={device.name}
          onClick={() => {
            haptic();
            toggle(device);
          }}
        />
      ) : (
        <span className="subrow-val">{statusText(device)}</span>
      )}
    </div>
  );
}

export function OtherControls({ device }) {
  const { id, group } = device;
  const siblingIds = useMemo(() => {
    if (!group.primary || group.size < 2) return [];
    return getState()
      .devices.filter((d) => d.group.id === group.id && d.id !== id)
      .map((d) => d.id);
  }, [id, group.id, group.primary, group.size]);

  if (siblingIds.length === 0) return null;

  return (
    <div className="sheet-section">
      <div className="sheet-label">{t('otherControls')}</div>
      {siblingIds.map((siblingId) => (
        <OtherControl key={siblingId} id={siblingId} />
      ))}
    </div>
  );
}
