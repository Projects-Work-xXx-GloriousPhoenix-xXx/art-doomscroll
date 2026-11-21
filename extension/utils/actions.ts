import { sendMessage, type WorkStatus } from '@/utils/messaging';
import type { WorkPayload } from '@/utils/pixiv';

export function saveWork(work: WorkPayload, status?: WorkStatus) {
    return sendMessage('saveWork', { work, status });
}