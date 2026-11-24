import { defineConfig } from 'wxt';
import { loadEnv } from 'vite';

export default defineConfig({
    manifest: ({ mode }) => {
        const env = loadEnv(mode, process.cwd(), 'WXT_');
        if (!env.WXT_API_URL) {
            throw new Error('WXT_API_URL is not set — see .env.example');
        }
        if (!env.WXT_GOOGLE_CLIENT_ID) {
            throw new Error('WXT_GOOGLE_CLIENT_ID is not set — see .env.example');
        }

        const apiOrigin = new URL(env.WXT_API_URL).origin;

        return {
            key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2ULZwIfqoSUHDrr/jFsanchxIvPvsT5ymEF65FawOayYCPiVRS/l866efHa2CR00DJji6cGAZuwQAepZ85pKpV8o6j3qLWWu+KpDS0mjwfCL523T5hkLQAJ9fpEJwRBUo3UsTXFsoENqyPLGsSV0ik5848EJ40IKdedpqpNV3oCTmVy0N/+Gy18bPVxaA+Jb9EzxeYhzsIqj8j9WOmlNXpIVGqFWzy6rBb/iS1KEtpZykyR09lTKMmjsh/dfQgrcUeG+hJDU+Er9ajxSmEy7gs+TlqhF0ICTx8cOzqc0Qs8ogWnuPErwI/FqranQcKjMePFUInxxhxZpdiyJ4U80hwIDAQAB',
            name: 'art-doomscroll',
            description: 'Save artists and works while scrolling',
            host_permissions: [`${apiOrigin}/*`],
            permissions: ['identity', 'storage'],
        };
    },
});
