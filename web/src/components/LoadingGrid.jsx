import { t } from '../lib/i18n.js';

export function LoadingGrid({ count = 8 }) {
  return (
    <div className="skeleton-grid" id="loading" aria-busy="true" aria-label={t('loadingDevices')}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-tile" />
      ))}
    </div>
  );
}
