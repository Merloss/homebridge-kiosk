import { getLang, LANGS, setLang, t } from '../lib/i18n.js';

const VIEW_LABELS = { grouped: 'viewGrouped', all: 'viewAll', debug: 'viewDebug' };

export function Toolbar({ views, view, onSelectView }) {
  const lang = getLang();

  return (
    <div className="toolbar">
      <div className="viewtoggle" role="group" aria-label={t('viewLabel')}>
        {views.map((name) => (
          <button
            key={name}
            className={`viewtoggle-btn${name === view ? ' active' : ''}`}
            data-view={name}
            onClick={() => onSelectView(name)}
          >
            {t(VIEW_LABELS[name])}
          </button>
        ))}
      </div>

      <div className="langtoggle" role="group" aria-label="Language">
        {LANGS.map((code) => (
          <button
            key={code}
            className={`langtoggle-btn${code === lang ? ' active' : ''}`}
            data-lang={code}
            onClick={() => setLang(code)}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
