import { localeTag, t } from '../lib/i18n.js';

export function ErrorBar({ ready, connected, error, updatedAt }) {
  if (!ready || connected) return null;

  const lastData = updatedAt
    ? new Date(updatedAt).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="errorbar" id="errorbar" role="status">
      <span className="errorbar-dot" />
      <span className="errorbar-text">{error ? `${t('unreachable')}: ${error}` : t('unreachable')}</span>
      {lastData && <span className="errorbar-since">{t('lastData', { time: lastData })}</span>}
    </div>
  );
}
