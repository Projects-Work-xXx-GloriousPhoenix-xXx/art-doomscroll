import { createQuickButton } from '@/components/quick-button/quick-button';
import { queueWork, unqueueWork, queueArtist, unqueueArtist } from '@/utils/actions';
import { fetchWork, fetchArtist, getArtworkId  } from '@/utils/pixiv/api';
import { getState } from '@/utils/state';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

// Pixiv DOM: analytics attributes, more stable than generated classes. May break on Pixiv redesigns.
const WORK_LINK_SELECTOR = 'a[href*="/artworks/"]';
const FOLLOW_SELECTOR = 'button[data-click-label="follow"]';
const DONE_ATTR = 'data-ad-done';

export function observeRecommendations(ctx: ContentScriptContext) {
    injectWorkButtons();
    injectArtistButtons();

    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            injectWorkButtons();
            injectArtistButtons();
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
}

function injectWorkButtons() {
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
        
        button.style.cssText = 'position: absolute; top: 6px; left: 6px; z-index: 1;';
        card.append(button);
    });
}

function injectArtistButtons() {
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
        button.style.cssText = 'margin-left: 6px; flex-shrink: 0;';
        followButton.after(button);
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