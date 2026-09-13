import { UNASSIGNED_ROOM } from '../../../shared/constants.js';
import { t } from './i18n.js';

export const roomLabel = (room) => (room === UNASSIGNED_ROOM ? t('otherRoom') : room);
