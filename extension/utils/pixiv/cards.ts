import { createQuickButton, type QuickButton } from '@/components/quick-button/quick-button';
import { queueWork, unqueueWork, queueArtist, unqueueArtist, lookupLibrary } from '@/utils/actions';
import { fetchWork, fetchArtist, getArtworkId  } from '@/utils/pixiv/api';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { onLibraryChange, type LibraryChange } from '@/utils/library-events';
import { currentArtist, getState, setState, subscribe } from '@/utils/state';

// Pixiv DOM: analytics attributes, more stable than generated classes. May break on Pixiv redesigns.
const WORK_LINK_SELECTOR = 'a[href*="/artworks/"]';
const FOLLOW_SELECTOR = 'button[data-click-label="follow"]';
const DONE_ATTR = 'data-ad-done';
const QUICK_ATTR = 'data-ad-quick';
const MIN_THUMB_SIZE = 64;

const registry = {
    work: new Map<string, Set<QuickButton>>(),
    artist: new Map<string, Set<QuickButton>>(),
};

function register(kind: LibraryChange['kind'], id: string, button: QuickButton) {
    const set = registry[kind].get(id) ?? new Set();
    set.add(button);
    registry[kind].set(id, set);
}

function applyChange(change: LibraryChange) {
    const set = registry[change.kind].get(change.externalId);
    if (!set) return;
    for (const button of set) {
        if (!button.element.isConnected) {
            set.delete(button);
            continue;
        }
        button.setStatus(change.status);
    }
    if (set.size === 0) registry[change.kind].delete(change.externalId);
}

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

    let wasSignedOut = getState().signedOut;
    let pageArtist = currentArtist(getState())?.artist.externalId;

    const unsubscribe = subscribe((s) => {
        const artist = currentArtist(s)?.artist.externalId;
        if (artist !== pageArtist) {
            pageArtist = artist;
            if (artist) unbindArtist(artist);
        }

        if (s.signedOut === wasSignedOut) return;
        wasSignedOut = s.signedOut;
        if (s.signedOut) removeAllButtons();
        else scan();
    });

    observer.observe(document.body, { 
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'data-gtm-user-id']
    });
    ctx.onInvalidated(() => observer.disconnect());
    ctx.onInvalidated(() => { unsubscribe(); });

    const offLibraryChange = onLibraryChange(applyChange);
    ctx.onInvalidated(offLibraryChange);
}

function unbindArtist(externalId: string) {
    registry.artist.get(externalId)?.forEach((button) => {
        const row = button.element.parentElement;
        button.element.remove();
        row?.removeAttribute(DONE_ATTR);
    });
    registry.artist.delete(externalId);
}

function unbind(container: Element) {
    container.querySelector(`:scope > [${QUICK_ATTR}]`)?.remove();
    container.removeAttribute(DONE_ATTR);
}

function injectWorkButtons(pending: Pending) {
    document.querySelectorAll<HTMLAnchorElement>(WORK_LINK_SELECTOR).forEach((link) => {
        if (!link.querySelector('img, figure')) return;

        const { width } = link.getBoundingClientRect();
        if (width > 0 && width < MIN_THUMB_SIZE) return;

        const id = getArtworkId(link.href);
        const card = link.parentElement;
        if (!id || !card) return;

        const bound = card.getAttribute(DONE_ATTR);
        if (bound === id) return;
        if (bound !== null) unbind(card);

        card.setAttribute(DONE_ATTR, id);

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

        button.element.setAttribute(QUICK_ATTR, '');
        button.element.style.cssText = 'position: absolute; top: 6px; left: 6px; z-index: 1;';
        card.append(button.element);

        addPending(pending, id, button);
        register('work', id, button);
    });
}

function injectArtistButtons(pending: Pending) {
    const currentArtistId = currentArtist(getState())?.artist.externalId;

    document.querySelectorAll<HTMLButtonElement>(FOLLOW_SELECTOR).forEach((followButton) => {
        const row = followButton.parentElement;
        const externalId = followButton.dataset.gtmUserId;
        if (!row || !externalId) return;

        const bound = row.getAttribute(DONE_ATTR);
        if (bound === externalId) return;
        if (bound !== null) unbind(row);
        if (externalId === currentArtistId) return;

        row.setAttribute(DONE_ATTR, externalId);

        const button = createQuickButton('⏱ Later', async () => {
            const result = await queueArtist('Pixiv', await fetchArtist(externalId));
            return {
                status: result.status,
                undo: result.isNew ? () => unqueueArtist(externalId, result.artistId) : undefined,
            };
        });

        button.element.setAttribute(QUICK_ATTR, '');
        button.element.style.cssText = 'margin-left: 6px; flex-shrink: 0;';
        followButton.after(button.element);

        addPending(pending, externalId, button);
        register('artist', externalId, button);
    });
}

async function undoQueue(id: string, workId: string) {
    const { work, save } = getState();
    const isCurrent = work?.externalId === id;

    if (isCurrent && !(save.kind === 'saved' && save.status === 'Queued')) {
        throw new Error('Status was changed in the panel');
    }

    await unqueueWork(id, workId);

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
    if (getState().signedOut) return;
    const works: Pending = new Map();
    const artists: Pending = new Map();
    injectWorkButtons(works);
    injectArtistButtons(artists);
    markSavedCards(works, artists);
}

function removeAllButtons() {
    document.querySelectorAll(`[${QUICK_ATTR}]`).forEach((el) => el.remove());
    document.querySelectorAll(`[${DONE_ATTR}]`).forEach((el) => el.removeAttribute(DONE_ATTR));

    registry.work.clear();
    registry.artist.clear();
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