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
});