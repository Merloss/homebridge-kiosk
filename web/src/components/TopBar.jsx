import { useEffect } from 'react';
import { t } from '../lib/i18n.js';

function connectionStatus({ ready, connected, mock }) {
  if (!ready) return { className: 'connecting', text: t('connecting') };
  if (!connected) return { className: 'offline', text: t('disconnected') };
  return { className: 'online', text: t(mock ? 'demo' : 'connected') };
}

export function TopBar({ clock, title, ready, connected, mock, onCount }) {
  const heading = title || t('home');
  const status = connectionStatus({ ready, connected, mock });

  useEffect(() => {
    document.title = heading;
  }, [heading]);

  return (
    <header className="topbar">
      <div className="clock">
        <div className="clock-time">{clock.time}</div>
        <div className="clock-date">{clock.date}</div>
      </div>

      <div className="topbar-center">
        <h1 className="home-title">{heading}</h1>
        <div className="home-sub">{ready && (onCount ? t('devicesOn', { n: onCount }) : t('allOff'))}</div>
      </div>

      <div className="topbar-right">
        <div className={`conn ${status.className}`} id="conn" title={t('connectionLabel')}>
          <span className="dot" />
          <span className="conn-text">{status.text}</span>
        </div>
      </div>
    </header>
  );
}
