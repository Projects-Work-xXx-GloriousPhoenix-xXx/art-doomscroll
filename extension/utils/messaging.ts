import { defineExtensionMessaging } from '@webext-core/messaging';
import type { WorkPayload } from '@/utils/pixiv';

export type WorkStatus = 'Queued' | 'Liked' | 'Disliked';

export interface SaveWorkResult {
    workId: string;
    artistId: string;
    status: WorkStatus;
    isNew: boolean;
    artistStatus: 'Queued' | 'Watching' | 'Seen' | null;
}

interface ProtocolMap {
    saveWork(data: { work: WorkPayload; status?: WorkStatus }): SaveWorkResult;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();