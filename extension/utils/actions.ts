import { sendMessage, type AddArtistResult, type LookupLibraryResult, type SaveWorkResult } from '@/utils/messaging';
import type { ArtistStatus, Platform, WorkStatus } from '@/utils/types';
import { getState, isBusy, setState } from '@/utils/state';
import type { WorkPayload } from '@/utils/pixiv/api';
import { isNotSignedIn } from '@/utils/errors';
import { emitLibraryChange } from '@/utils/library-events';

const LOOKUP_CHUNK = 100;

export async function setWorkStatus(status: WorkStatus) {
    const { work, save, signedOut } = getState();
    if (!work || signedOut || isBusy(save)) return;
    if (save.kind === 'saved' && save.status === status) return;

    const workId = save.kind === 'saved' ? save.workId : null;
    setState({ save: { kind: 'saving', status } });

    try {
        if (workId !== null) {
            const result = await sendMessage('updateWorkStatus', { workId, status });
            emitLibraryChange({ kind: 'work', externalId: work.externalId, status: result.newStatus }); 
            if (getState().work?.externalId !== work.externalId) return;
            setState({ save: { kind: 'saved', workId, status: result.newStatus } });
        } else {
            const result = await sendMessage('saveWork', { work, status });
            emitLibraryChange({ kind: 'work', externalId: work.externalId, status: result.status }); 
            if (getState().work?.externalId !== work.externalId) return;
            setState({ save: { kind: 'saved', workId: result.workId, status: result.status } });
        }
    } catch (e) {
        if (getState().work?.externalId !== work.externalId) return;
        if (isNotSignedIn(e)) {
            setState({ signedOut: true, save: { kind: 'idle' } });
            return;
        }
        setState({ save: { kind: 'error', message: String(e) } });
    }
}

export async function setArtistStatus(status: ArtistStatus) {
    const { work, artist, signedOut } = getState();
    if (!work || signedOut || isBusy(artist)) return;
    if (artist.kind === 'saved' && artist.status === status) return;

    const artistId = artist.kind === 'saved' ? artist.artistId : null;
    setState({ artist: { kind: 'saving', status } });

    try {
        if (artistId !== null) {
            const result = await sendMessage('updateArtistStatus', { artistId, status });
            emitLibraryChange({ kind: 'artist', externalId: work.artist.externalId, status: result.newStatus }); 
            if (getState().work?.externalId !== work.externalId) return;
            setState({ artist: { kind: 'saved', artistId, status: result.newStatus } });
        } else {
            const result = await sendMessage('addArtist', { platform: work.platform, artist: work.artist, status });
            emitLibraryChange({ kind: 'artist', externalId: work.artist.externalId, status: result.status }); 
            if (getState().work?.externalId !== work.externalId) return;
            setState({ artist: { kind: 'saved', artistId: result.artistId, status: result.status } });
        }
    } catch (e) {
        if (getState().work?.externalId !== work.externalId) return;
        if (isNotSignedIn(e)) {
            setState({ signedOut: true, artist: { kind: 'none' } });
            return;
        }
        setState({ artist: { kind: 'error', message: String(e) } });
    }
}

export async function queueWork(work: WorkPayload, status?: WorkStatus): Promise<SaveWorkResult> {
    const result = await sendMessage('saveWork', { work, status });
    emitLibraryChange({ kind: 'work', externalId: work.externalId, status: result.status });
    return result;
}

export async function queueArtist(platform: Platform, artist: WorkPayload['artist'], status?: ArtistStatus): Promise<AddArtistResult> {
    const result = await sendMessage('addArtist', { platform, artist, status });
    emitLibraryChange({ kind: 'artist', externalId: artist.externalId, status: result.status });
    return result;
}

export async function unqueueWork(externalId: string, workId: string): Promise<void> {
    await sendMessage('deleteWork', { workId });
    emitLibraryChange({ kind: 'work', externalId, status: null });
}

export async function unqueueArtist(externalId: string, artistId: string): Promise<void> {
    await sendMessage('deleteArtist', { artistId });
    emitLibraryChange({ kind: 'artist', externalId, status: null });
}

export async function removeWork() {
    const { work, save } = getState();
    if (!work || save.kind !== 'saved') return;

    const workId = save.workId;
    setState({ save: { kind: 'removing' } });
    try {
        await unqueueWork(work.externalId, workId);
        if (getState().work?.externalId !== work.externalId) return;
        setState({ save: { kind: 'idle' } });
    } catch (e) {
        if (getState().work?.externalId !== work.externalId) return;
        if (isNotSignedIn(e)) {
            setState({ signedOut: true, save: { kind: 'idle' } });
            return;
        }
        setState({ save: { kind: 'error', message: String(e) } });
    }
}

export async function removeArtist() {
    const { work, artist } = getState();
    if (!work || artist.kind !== 'saved') return;

    const artistId = artist.artistId;
    setState({ artist: { kind: 'removing' } });
    try {
        await unqueueArtist(work.artist.externalId, artistId);
        if (getState().work?.externalId !== work.externalId) return;
        setState({ artist: { kind: 'none' } });
    } catch (e) {
        if (getState().work?.externalId !== work.externalId) return;
        if (isNotSignedIn(e)) {
            setState({ signedOut: true, artist: { kind: 'none' } });
            return;
        }
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

export async function lookupLibrary(platform: Platform, works: string[], artists: string[]): Promise<LookupLibraryResult> {
    const result: LookupLibraryResult = { works: {}, artists: {} };

    for (let i = 0; i < Math.max(works.length, artists.length); i += LOOKUP_CHUNK) {
        const part = await sendMessage('lookupLibrary', {
            platform,
            works: works.slice(i, i + LOOKUP_CHUNK),
            artists: artists.slice(i, i + LOOKUP_CHUNK),
        });
        Object.assign(result.works, part.works);
        Object.assign(result.artists, part.artists);
    }
    return result;
}