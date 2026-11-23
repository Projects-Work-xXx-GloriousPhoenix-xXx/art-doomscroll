import { apiFetch, getUser, signIn, signOut } from '@/utils/auth';
import { onMessage } from '@/utils/messaging';

const API_URL = import.meta.env.WXT_API_URL;

export default defineBackground(() => {
    onMessage('saveWork', async ({ data }) => {
        const res = await apiFetch('/works', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data.work, status: data.status }),
        });
        return res.json();
    });

    onMessage('deleteWork', async ({ data }) => {
        await apiFetch(`/works/${data.workId}`, { method: 'DELETE' });
    });
    
    onMessage('lookupWork', async ({ data }) => {
        const params = new URLSearchParams({
            platform: data.platform,
            externalId: data.externalId,
            artistExternalId: data.artistExternalId,
        });
        const res = await apiFetch(`/works/lookup?${params}`);
        return res.json();
    });

    onMessage('updateWorkStatus', async ({ data }) => {
        const res = await apiFetch(`/works/${data.workId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: data.status }),
        });
        return res.json();
    });

    onMessage('addArtist', async ({ data }) => {
        const res = await apiFetch('/artists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: data.platform, ...data.artist, status: data.status }),
        });
        return res.json();
    });

    onMessage('updateArtistStatus', async ({ data }) => {
        const res = await apiFetch(`/artists/${data.artistId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: data.status }),
        });
        return res.json();
    });

    onMessage('deleteArtist', async ({ data }) => {
        await apiFetch(`/artists/${data.artistId}`, { method: 'DELETE' });
    });

    onMessage('lookupLibrary', async ({ data }) => {
        const res = await apiFetch('/library/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: data.platform, works: data.works, artists: data.artists }),
        });
        return res.json();
    });

    onMessage('getUser', () => getUser());
    onMessage('signIn', () => signIn());
    onMessage('signOut', () => signOut());

    Object.assign(globalThis, { signIn, signOut, getUser });
});