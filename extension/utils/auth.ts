import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';

const API_URL = import.meta.env.WXT_API_URL;
const GOOGLE_CLIENT_ID = import.meta.env.WXT_GOOGLE_CLIENT_ID;

interface Tokens {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
}

export interface AuthUser {
    name: string;
    email: string;
    picture?: string;
}

interface Session {
    tokens: Tokens;
    user: AuthUser;
}

const sessionItem = storage.defineItem<Session>('local:session');

export class NotSignedInError extends Error {
    override name = 'NotSignedInError';
}

export class ApiError extends Error {
    override name = 'ApiError';
    constructor(public status: number, body: string) {
        super(`API ${status}: ${body}`);
    }
}

export async function signIn(): Promise<AuthUser> {
    const nonce = crypto.randomUUID();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        response_type: 'id_token',
        redirect_uri: browser.identity.getRedirectURL(),
        scope: 'openid email profile',
        nonce,
        prompt: 'select_account',
    }).toString();

    const resultUrl = await browser.identity.launchWebAuthFlow({ url: url.toString(), interactive: true });
    if (!resultUrl) throw new Error('Sign-in cancelled');

    const idToken = new URLSearchParams(new URL(resultUrl).hash.slice(1)).get('id_token');
    if (!idToken) throw new Error('No id_token in response');

    const claims = decodeJwtPayload(idToken);
    if (claims.nonce !== nonce) throw new Error('Nonce mismatch');

    const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());

    const user: AuthUser = { name: claims.name ?? claims.email, email: claims.email, picture: claims.picture };
    await sessionItem.setValue({ tokens: await res.json(), user });
    return user;
}

function decodeJwtPayload(jwt: string): Record<string, any> {
    const payload = jwt.split('.')[1];
    if (!payload) throw new Error('Malformed JWT');

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
}

let refreshing: Promise<Tokens | null> | null = null;

function refresh(): Promise<Tokens | null> {
    refreshing ??= doRefresh().finally(() => { refreshing = null; });
    return refreshing;
}

async function doRefresh(): Promise<Tokens | null> {
    const session = await sessionItem.getValue();
    if (!session) return null;

    const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
    });

    if (res.status === 401) {
        await sessionItem.removeValue();
        return null;
    }
    if (!res.ok) throw new ApiError(res.status, await res.text());

    const tokens: Tokens = await res.json();
    await sessionItem.setValue({ ...session, tokens });
    return tokens;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    let res = await send(path, init, await getAccessToken());

    if (res.status === 401) {
        const tokens = await refresh();
        if (!tokens) throw new NotSignedInError();
        res = await send(path, init, tokens.accessToken);
    }

    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res;
}

async function getAccessToken(): Promise<string> {
    const session = await sessionItem.getValue();
    if (!session) throw new NotSignedInError();

    const expiresIn = Date.parse(session.tokens.accessTokenExpiresAt) - Date.now();
    if (expiresIn > 30_000) return session.tokens.accessToken;

    const tokens = await refresh();
    if (!tokens) throw new NotSignedInError();
    return tokens.accessToken;
}

function send(path: string, init: RequestInit, token: string): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function signOut(): Promise<void> {
    const session = await sessionItem.getValue();
    await sessionItem.removeValue();
    if (!session) return;

    await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
    }).catch(() => {});
}

export async function getUser(): Promise<AuthUser | null> {
    return (await sessionItem.getValue())?.user ?? null;
}