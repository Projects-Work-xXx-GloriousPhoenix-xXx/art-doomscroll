import type { Platform } from "../types";

export function getArtworkId(url: string): string | null {
    const match = new URL(url).pathname.match(/^\/(?:en\/)?artworks\/(\d+)/);
    return match?.[1] ?? null;
}

interface PixivIllust {
    illustId: string;
    illustTitle: string;
    userId: string;
    userName: string;
    userAccount?: string;
    urls: { thumb?: string; small?: string };
}

export interface WorkPayload {
    platform: Platform;
    externalId: string;
    url: string;
    title?: string;
    thumbnailUrl?: string;
    artist: {
        externalId: string;
        profileUrl: string;
        handle?: string;
        displayName?: string;
        avatarUrl?: string;
    };
}

interface PixivUser {
    userId: string;
    name: string;
    pixivId: string;
    imageBig: string;
}

export async function fetchWork(id: string): Promise<WorkPayload> {
    const res = await fetch(`/ajax/illust/${id}`);
    const json = await res.json();
    if (!res.ok || json.error) {
        throw new Error(`Pixiv: ${json.message ?? res.status}`);
    }

    const illust = json.body as PixivIllust;
    const artist = await fetchArtist(illust.userId).catch(() => ({
        externalId: illust.userId,
        profileUrl: `https://www.pixiv.net/users/${illust.userId}`,
        handle: illust.userAccount,
        displayName: illust.userName,
    }));

    return {
        platform: 'Pixiv',
        externalId: illust.illustId,
        url: `https://www.pixiv.net/artworks/${illust.illustId}`,
        title: illust.illustTitle,
        thumbnailUrl: illust.urls.small ?? illust.urls.thumb,
        artist
    };
}

export async function fetchArtist(userId: string): Promise<WorkPayload['artist']> {
    const res = await fetch(`/ajax/user/${userId}?full=0`);
    const json = await res.json();
    if (!res.ok || json.error) {
        throw new Error(`Pixiv: ${json.message ?? res.status}`);
    }

    const user = json.body as PixivUser;
    return {
        externalId: user.userId,
        profileUrl: `https://www.pixiv.net/users/${user.userId}`,
        handle: user.pixivId,
        displayName: user.name,
        avatarUrl: user.imageBig,
    };
}