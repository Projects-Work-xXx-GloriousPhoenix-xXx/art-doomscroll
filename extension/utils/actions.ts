import { sendMessage } from '@/utils/messaging';
import type { ArtistStatus, WorkStatus } from '@/utils/types';
import { getState, setState } from '@/utils/state';

export async function setWorkStatus(status: WorkStatus) {
    const { work, save } = getState();
    if (!work || save.kind === 'saving' || save.kind === 'checking') return;
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
    if (!work || artist.kind === 'checking' || artist.kind === 'saving') return;
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