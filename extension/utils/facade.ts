// Pixiv DOM: analytics attributes, more stable than generated classes. May break on Pixiv redesigns.
import { setArtistStatus, setWorkStatus } from "@/utils/actions";
import { getState } from "@/utils/state";

const BOOKMARK_SELECTOR = 'button.gtm-main-bookmark';
const FOLLOW_SELECTOR = 'button[data-click-label="follow"]';

export function handleFacadeClick(e: MouseEvent) {
    if (!(e.target instanceof Element)) return;

    if (e.target.closest(BOOKMARK_SELECTOR)) {
        setWorkStatus('Liked');
        return;
    }

    const follow = e.target.closest<HTMLButtonElement>(FOLLOW_SELECTOR);
    if (follow) {
        const artist = getState().work?.artist;
        if (!artist || follow.dataset.gtmUserId !== artist.externalId) return;

        setArtistStatus(follow.dataset.variant === 'Primary' ? 'Watching' : 'Seen');
    }
}