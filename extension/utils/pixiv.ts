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
    platform: 'Pixiv';
    externalId: string;
    url: string;
    title?: string;
    thumbnailUrl?: string;
    artist: {
        externalId: string;
        profileUrl: string;
        handle?: string;
        displayName?: string;
    };
}

export async function fetchWork(id: string): Promise<WorkPayload> {
    const res = await fetch(`/ajax/illust/${id}`);
    const json = await res.json();
    if (!res.ok || json.error) {
        throw new Error(`Pixiv: ${json.message ?? res.status}`);
    }

    const illust = json.body as PixivIllust;

    return {
        platform: 'Pixiv',
        externalId: illust.illustId,
        url: `https://www.pixiv.net/artworks/${illust.illustId}`,
        title: illust.illustTitle,
        thumbnailUrl: illust.urls.small ?? illust.urls.thumb,
        artist: {
            externalId: illust.userId,
            profileUrl: `https://www.pixiv.net/users/${illust.userId}`,
            handle: illust.userAccount,
            displayName: illust.userName,
        },
    };
}