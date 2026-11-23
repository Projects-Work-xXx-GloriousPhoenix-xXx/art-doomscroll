import { createQuickButton, type QuickButton } from '@/components/quick-button/quick-button';
import { queueWork, unqueueWork, queueArtist, unqueueArtist, lookupLibrary } from '@/utils/actions';
import { fetchWork, fetchArtist, getArtworkId  } from '@/utils/pixiv/api';
import { getState, setState } from '@/utils/state';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

// Pixiv DOM: analytics attributes, more stable than generated classes. May break on Pixiv redesigns.
const WORK_LINK_SELECTOR = 'a[href*="/artworks/"]';
const FOLLOW_SELECTOR = 'button[data-click-label="follow"]';
const DONE_ATTR = 'data-ad-done';

type Pending = Map<string, QuickButton[]>;

export function observeRecommendations(ctx: ContentScriptContext) {
    scan();

    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            scan();
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
}

function injectWorkButtons(pending: Pending) {
    document.querySelectorAll<HTMLAnchorElement>(WORK_LINK_SELECTOR).forEach((link) => {
        if (!link.querySelector('img, figure')) return;
        const id = getArtworkId(link.href);
        const card = link.parentElement;
        if (!id || !card || card.hasAttribute(DONE_ATTR)) return;
        card.setAttribute(DONE_ATTR, '');

        if (getComputedStyle(card).position === 'static') {
            card.style.position = 'relative';
        }

        const button = createQuickButton('⏱ Later', async () => {
            const result = await queueWork(await fetchWork(id));

            if (getState().work?.externalId === id) {
                setState({ save: { kind: 'saved', workId: result.workId, status: result.status } });
            }

            return {
                status: result.status,
                undo: result.isNew ? () => undoQueue(id, result.workId) : undefined,
            };
        });

        button.element.style.cssText = 'position: absolute; top: 6px; left: 6px; z-index: 1;';
        card.append(button.element);

        addPending(pending, id, button);
    });
}

function injectArtistButtons(pending: Pending) {
    const currentArtistId = getState().work?.artist.externalId;

    document.querySelectorAll<HTMLButtonElement>(FOLLOW_SELECTOR).forEach((followButton) => {
        const row = followButton.parentElement;
        const externalId = followButton.dataset.gtmUserId;
        if (!row || !externalId || row.hasAttribute(DONE_ATTR)) return;
        if (externalId === currentArtistId) return;
        row.setAttribute(DONE_ATTR, '');

        const button = createQuickButton('⏱ Later', async () => {
            const result = await queueArtist('Pixiv', await fetchArtist(externalId));
            return {
                status: result.status,
                undo: result.isNew ? () => unqueueArtist(result.artistId) : undefined,
            };
        });

        button.element.style.cssText = 'margin-left: 6px; flex-shrink: 0;';
        followButton.after(button.element);

        addPending(pending, externalId, button);
    });
}

async function undoQueue(id: string, workId: string) {
    const { work, save } = getState();
    const isCurrent = work?.externalId === id;

    if (isCurrent && !(save.kind === 'saved' && save.status === 'Queued')) {
        throw new Error('Status was changed in the panel');
    }

    await unqueueWork(workId);

    if (getState().work?.externalId === id) {
        setState({ save: { kind: 'idle' } });
    }
}

function addPending(pending: Pending, id: string, button: QuickButton) {
    const list = pending.get(id) ?? [];
    list.push(button);
    pending.set(id, list);
}

function scan() {
    const works: Pending = new Map();
    const artists: Pending = new Map();
    injectWorkButtons(works);
    injectArtistButtons(artists);
    markSavedCards(works, artists);
}

async function markSavedCards(works: Pending, artists: Pending) {
    if (works.size === 0 && artists.size === 0) return;
    try {
        const result = await lookupLibrary('Pixiv', [...works.keys()], [...artists.keys()]);
        for (const [id, info] of Object.entries(result.works)) {
            works.get(id)?.forEach((b) => b.markSaved(info.status));
        }
        for (const [id, info] of Object.entries(result.artists)) {
            artists.get(id)?.forEach((b) => b.markSaved(info.status));
        }
    } catch (err) {
        console.warn('[art-doomscroll] cards: lookup failed', err);
    }
}