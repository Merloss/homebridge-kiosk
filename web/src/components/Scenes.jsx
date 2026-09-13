import { Sparkles } from 'lucide-react';
import { haptic } from '../lib/haptics.js';
import { t } from '../lib/i18n.js';
import { isDemo, runScene } from '../lib/store.js';
import { toast } from '../lib/toast.js';

async function run(scene) {
  haptic();
  if (isDemo()) return toast(t('sceneRan', { name: scene.name }));
  try {
    const result = await runScene(scene.id);
    toast(t(result.ok ? 'sceneRan' : 'scenePartial', { name: scene.name }));
  } catch {
    toast(t('sceneFailed'));
  }
}

export function Scenes({ scenes }) {
  if (scenes.length === 0) return null;

  return (
    <div className="scenes">
      {scenes.map((scene) => (
        <button key={scene.id} className="scene" onClick={() => run(scene)}>
          <span className="scene-icon">{scene.icon || <Sparkles size={16} aria-hidden="true" />}</span>
          <span>{scene.name}</span>
        </button>
      ))}
    </div>
  );
}
