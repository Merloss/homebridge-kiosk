import { House } from 'lucide-react';
import { t } from '../lib/i18n.js';

export function EmptyState() {
  return (
    <div className="empty" id="empty">
      <House className="empty-icon" size={34} strokeWidth={1.5} aria-hidden="true" />
      <div className="empty-title">{t('emptyTitle')}</div>
      <div className="empty-text">{t('emptyText')}</div>
    </div>
  );
}
