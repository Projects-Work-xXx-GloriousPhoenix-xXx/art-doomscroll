import { onMessage } from '@/utils/messaging';

const API_URL = import.meta.env.WXT_API_URL;

export default defineBackground(() => {
    onMessage('saveWork', async ({ data }) => {
        const res = await fetch(`${API_URL}/works`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data.work, status: data.status }),
        });

        if (!res.ok) {
            throw new Error(`API ${res.status}: ${await res.text()}`);
        }
        
        return res.json();
    });
    
    onMessage('lookupWork', async ({ data })=> {
        const params = new URLSearchParams({ 
            platform: data.platform, 
            externalId: data.externalId, 
            artistExternalId: data.artistExternalId 
        });

        const res = await fetch(`${API_URL}/works/lookup?${params}`);
        if (!res.ok) {
            throw new Error(`API ${res.status}: ${await res.text()}`);
        }

        return res.json();
    });

    onMessage('updateWorkStatus', async ({ data }) => {
        const res = await fetch(`${API_URL}/works/${data.workId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: data.status }),
        });

        if (!res.ok) {
            throw new Error(`API ${res.status}: ${await res.text()}`);
        }
        
        return res.json();
    });

    onMessage('addArtist', async ({ data }) => {
        const res = await fetch(`${API_URL}/artists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: data.platform, ...data.artist, status: data.status }),
        });

        if (!res.ok) {
            throw new Error(`API ${res.status}: ${await res.text()}`);
        }

        return res.json();
    });

    onMessage('updateArtistStatus', async ({ data }) => {
        const res = await fetch(`${API_URL}/artists/${data.artistId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: data.status }),
        });

        if (!res.ok) {
            throw new Error(`API ${res.status}: ${await res.text()}`);
        }

        return res.json();
    });

    onMessage('deleteWork', async ({ data }) => {
        const res = await fetch(`${API_URL}/works/${data.workId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    });

    onMessage('deleteArtist', async ({ data }) => {
        const res = await fetch(`${API_URL}/artists/${data.artistId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    });

    onMessage('lookupLibrary', async ({ data }) => {
        const res = await fetch(`${API_URL}/library/lookup`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: data.platform, works: data.works, artists: data.artists }),
        });

        if (!res.ok) {
            throw new Error(`API ${res.status}: ${await res.text()}`);
        }
        
        return res.json();
    });
});