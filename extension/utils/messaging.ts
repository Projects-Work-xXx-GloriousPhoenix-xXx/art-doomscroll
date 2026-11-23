import { defineExtensionMessaging } from '@webext-core/messaging';
import type { WorkPayload } from '@/utils/pixiv/api';
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

export interface AddArtistResult { 
    artistId: string;
    profileId: string;
    status: ArtistStatus;
    isNew: boolean;
}

export interface LookupLibraryResult {
    works: Record<string, { workId: string; status: WorkStatus }>;
    artists: Record<string, { artistId: string; status: ArtistStatus }>;
}

interface ProtocolMap {
    saveWork(data: { work: WorkPayload; status?: WorkStatus }): SaveWorkResult;
    lookupWork(data: { platform: Platform, externalId: string; artistExternalId: string }): LookupWorkResult;
    updateWorkStatus(data: { workId: string, status: WorkStatus }): { newStatus: WorkStatus };
    deleteWork(data: { workId: string }): void;

    addArtist(data: { platform: Platform; artist: WorkPayload['artist']; status?: ArtistStatus }): AddArtistResult;
    updateArtistStatus(data: { artistId: string; status: ArtistStatus }): { newStatus: ArtistStatus };
    deleteArtist(data: { artistId: string }): void;
    
    lookupLibrary(data: { platform: Platform; works: string[]; artists: string[] }): LookupLibraryResult;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

