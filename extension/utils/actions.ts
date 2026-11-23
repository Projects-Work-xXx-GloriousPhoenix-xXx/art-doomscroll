import { sendMessage, type AddArtistResult, type SaveWorkResult } from '@/utils/messaging';
import type { ArtistStatus, Platform, WorkStatus } from '@/utils/types';
import { getState, isBusy, setState, type ArtistState } from '@/utils/state';
import type { WorkPayload } from '@/utils/pixiv/api';

export async function setWorkStatus(status: WorkStatus) {
    const { work, save } = getState();
    if (!work || isBusy(save)) return;
    if (save.kind === 'saved' && save.status === status) return;

    const workId = save.kind === 'saved' ? save.workId : null;
    setState({ save: { kind: 'saving', status } });

    try {
        if (workId !== null) {
            const result = await sendMessage('updateWorkStatus', { workId, status });
            if (getState().work?.externalId !== work.externalId) return;
            setState({ save: { kind: 'saved', workId, status: result.newStatus } });
        } else {
            const result = await sendMessage('saveWork', { work, status });
            if (getState().work?.externalId !== work.externalId) return;
            setState({ save: { kind: 'saved', workId: result.workId, status: result.status } });
        }
    } catch (e) {
        if (getState().work?.externalId !== work.externalId) return;
        setState({ save: { kind: 'error', message: String(e) } });
    }
}

export async function setArtistStatus(status: ArtistStatus) {
    const { work, artist } = getState();
    if (!work || isBusy(artist)) return;
    if (artist.kind === 'saved' && artist.status === status) return;

    const artistId = artist.kind === 'saved' ? artist.artistId : null;
    setState({ artist: { kind: 'saving', status } });

    try {
        if (artistId !== null) {
            const result = await sendMessage('updateArtistStatus', { artistId, status });
            if (getState().work?.externalId !== work.externalId) return;
            setState({ artist: { kind: 'saved', artistId, status: result.newStatus } });
        } else {
            const result = await sendMessage('addArtist', { platform: work.platform, artist: work.artist, status });
            if (getState().work?.externalId !== work.externalId) return;
            setState({ artist: { kind: 'saved', artistId: result.artistId, status: result.status } });
        }
    } catch (e) {
        if (getState().work?.externalId !== work.externalId) return;
        setState({ artist: { kind: 'error', message: String(e) } });
    }
}

export async function unqueueWork(workId: string): Promise<void> {
    await sendMessage('deleteWork', { workId });
}

export async function queueWork(work: WorkPayload, status?: WorkStatus): Promise<SaveWorkResult> {
    return sendMessage('saveWork', { work, status });
}

export async function queueArtist(platform: Platform, artist: WorkPayload['artist'], status?: ArtistStatus): Promise<AddArtistResult> {
    return sendMessage('addArtist', { platform, artist, status });
}

export async function unqueueArtist(artistId: string): Promise<void> {
    await sendMessage('deleteArtist', { artistId });
}

export async function removeWork() {
    const { work, save } = getState();
    if (!work || save.kind !== 'saved') return;

    const workId = save.workId;
    setState({ save: { kind: 'removing' } });
    try {
        await unqueueWork(workId);
        if (getState().work?.externalId !== work.externalId) return;
        setState({ save: { kind: 'idle' } });
    } catch (e) {
        if (getState().work?.externalId !== work.externalId) return;
        setState({ save: { kind: 'error', message: String(e) } });
    }
}

export async function removeArtist() {
    const { work, artist } = getState();
    if (!work || artist.kind !== 'saved') return;

    const artistId = artist.artistId;
    setState({ artist: { kind: 'removing' } });
    try {
        await unqueueArtist(artistId);
        if (getState().work?.externalId !== work.externalId) return;
        setState({ artist: { kind: 'none' } });
    } catch (e) {
        if (getState().work?.externalId !== work.externalId) return;
        setState({ artist: { kind: 'error', message: String(e) } });
    }
}

export async function toggleWorkStatus(status: WorkStatus) {
    const { save } = getState();
    if (save.kind === 'saved' && save.status === status) {
        await removeWork();
    } else {
        await setWorkStatus(status);
    }
}

export async function toggleArtistStatus(status: ArtistStatus) {
    const { artist } = getState();
    if (artist.kind === 'saved' && artist.status === status) {
        await removeArtist();
    } else {
        await setArtistStatus(status);
    }
}