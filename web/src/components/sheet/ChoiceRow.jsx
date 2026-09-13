import { haptic } from '../../lib/haptics.js';
import { setChar } from '../../lib/store.js';

export function ChoiceRow({ device, char, options, label, act = 'set' }) {
  const choose = (value) => {
    haptic();
    setChar(device, char, value, { immediate: true });
  };

  return (
    <div className="sheet-section">
      {label && <div className="sheet-label">{label}</div>}
      <div className="btn-row">
        {options.map((option) => (
          <button
            key={option.value}
            className={`btn${option.active ? ' active' : ''}`}
            data-act={act}
            data-char={char}
            data-value={option.value}
            onClick={() => choose(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
