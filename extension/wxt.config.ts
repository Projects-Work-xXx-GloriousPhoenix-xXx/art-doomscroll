import { defineConfig } from 'wxt';
import { loadEnv } from 'vite';

export default defineConfig({
    manifest: ({ mode }) => {
        const env = loadEnv(mode, process.cwd(), 'WXT_');
        if (!env.WXT_API_URL) {
            throw new Error('WXT_API_URL is not set — copy .env.example to .env');
        }

        const apiOrigin = new URL(env.WXT_API_URL).origin;

        return {
            name: 'art-doomscroll',
            description: 'Save artists and works while scrolling',
            host_permissions: [`${apiOrigin}/*`],
        };
    },
});
