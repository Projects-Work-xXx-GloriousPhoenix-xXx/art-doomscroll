import { queueArtist, queueWork, setArtistStatus, setWorkStatus } from '@/utils/actions';
import { fetchArtist, fetchWork, getArtworkId } from '@/utils/pixiv/api';
import { getState } from '@/utils/state';
import type { ArtistStatus, WorkStatus } from '@/utils/types';

// Pixiv DOM: analytics attributes, more stable than generated classes. May break on Pixiv redesigns.
const BOOKMARK_SELECTOR = 'button.gtm-main-bookmark';
const CARD_BOOKMARK_SELECTOR = '[data-ga4-label="bookmark_button"] button';
const FOLLOW_SELECTOR = 'button[data-click-label="follow"]';
const BOOKMARKED_COLOR = 'rgb(255, 64, 96)';

export function handleFacadeClick(e: MouseEvent) {
    if (!(e.target instanceof Element)) return;

    if (e.target.closest(BOOKMARK_SELECTOR)) {
        setWorkStatus('Liked');
        return;
    }

    const cardBookmark = e.target.closest(CARD_BOOKMARK_SELECTOR);
    if (cardBookmark) {
        const id = findCardWorkId(cardBookmark);
        if (id) trackWork(id, isBookmarked(cardBookmark) ? 'Disliked' : 'Liked');
        return;
    }

    const follow = e.target.closest<HTMLButtonElement>(FOLLOW_SELECTOR);
    if (follow) {
        const userId = follow.dataset.gtmUserId;
        if (!userId) return;
        trackArtist(userId, follow.dataset.variant === 'Primary' ? 'Watching' : 'Seen');
    }
}

function trackWork(id: string, status: WorkStatus) {
    if (id === getState().work?.externalId) {
        setWorkStatus(status);
        return;
    }
    fetchWork(id)
        .then((work) => queueWork(work, status))
        .catch((err) => console.warn('[art-doomscroll] facade: failed to save work', err));
}

function trackArtist(userId: string, status: ArtistStatus) {
    if (userId === getState().work?.artist.externalId) {
        setArtistStatus(status);
        return;
    }
    fetchArtist(userId)
        .then((artist) => queueArtist('Pixiv', artist, status))
        .catch((err) => console.warn('[art-doomscroll] facade: failed to save artist', err));
}

function findCardWorkId(el: Element): string | null {
    let node = el.parentElement;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
        const link = node.querySelector<HTMLAnchorElement>('a[href*="/artworks/"]');
        if (link) return getArtworkId(link.href);
    }
    return null;
}

function isBookmarked(button: Element): boolean {
    const svg = button.querySelector('svg');
    return !!svg && getComputedStyle(svg).color === BOOKMARKED_COLOR;
}