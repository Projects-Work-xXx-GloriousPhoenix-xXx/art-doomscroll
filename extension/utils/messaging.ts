import { defineExtensionMessaging } from '@webext-core/messaging';
import type { WorkPayload } from '@/utils/pixiv';
import type { ArtistStatus, Platform, WorkStatus } from '@/utils/types';

export interface SaveWorkResult {
    workId: string;
    artistId: string;
    status: WorkStatus;
    isNew: boolean;
    artistStatus: ArtistStatus | null;
}

export interface LookupWorkResult {
    work: { workId: string; status: WorkStatus } | null;
    artist: { artistId: string; status: ArtistStatus } | null;
}

interface ProtocolMap {
    saveWork(data: { work: WorkPayload; status?: WorkStatus }): SaveWorkResult;
    lookupWork(data: { platform: Platform, externalId: string; artistExternalId: string }): LookupWorkResult;
    updateWorkStatus(data: { workId: string, status: WorkStatus }): { newStatus: WorkStatus };
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

