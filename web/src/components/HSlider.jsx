import { useSliderDrag } from '../hooks/useSliderDrag.js';
import { clamp } from '../lib/device.js';

export function HSlider({ device, char, label, min, max, invert = false, showValue = false, className = '' }) {
  const value = clamp(Number(device.values[char] ?? min), min, max);
  const ratio = (value - min) / (max - min);
  const position = (invert ? 1 - ratio : ratio) * 100;

  const drag = useSliderDrag(device, char, (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const p = clamp((event.clientX - box.left) / box.width, 0, 1);
    return Math.round(min + (invert ? 1 - p : p) * (max - min));
  });

  const trackStyle =
    char === 'Saturation'
      ? { background: `linear-gradient(90deg, #f2f2f2, hsl(${device.values.Hue ?? 0}, 100%, 55%))` }
      : undefined;

  return (
    <div className="sheet-section">
      <div className="sheet-label">{label}</div>
      <div className={`hslider ${className}`} data-char={char} style={trackStyle} {...drag}>
        <div className="hslider-thumb" style={{ left: `${position}%` }} />
        {showValue && <div className="hslider-label">{Math.round(value)}%</div>}
      </div>
    </div>
  );
}
