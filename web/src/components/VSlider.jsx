import { useSliderDrag } from '../hooks/useSliderDrag.js';
import { clamp } from '../lib/device.js';

function displayedValue({ values }, char) {
  if (char === 'Brightness') return values.On ? (values.Brightness ?? 0) : 0;
  if (char === 'TargetPosition') return values.CurrentPosition ?? values.TargetPosition ?? 0;
  return values[char] ?? 0;
}

export function VSlider({ device, char, label }) {
  const value = clamp(displayedValue(device, char), 0, 100);
  const drag = useSliderDrag(device, char, (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    return Math.round(clamp(1 - (event.clientY - box.top) / box.height, 0, 1) * 100);
  });

  return (
    <div className="sheet-section">
      <div className="sheet-label">{label}</div>
      <div className={`vslider${value < 22 ? ' low' : ''}`} data-char={char} {...drag}>
        <div className="vslider-fill" style={{ height: `${value}%` }} />
        <div className="vslider-value">{Math.round(value)}%</div>
      </div>
    </div>
  );
}
