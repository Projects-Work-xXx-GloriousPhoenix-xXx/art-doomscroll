import { createQuickButton } from '@/components/quick-button/quick-button';
import { queueWork, unqueueWork } from '@/utils/actions';
import { fetchWork, getArtworkId } from '@/utils/pixiv';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

// Pixiv DOM: analytics attributes, more stable than generated classes. May break on Pixiv redesigns.
const WORK_LINK_SELECTOR = 'a[data-ga4-label="thumbnail_link"][href*="/artworks/"]';
const DONE_ATTR = 'data-ad-done';

function injectWorkButtons() {
    document.querySelectorAll<HTMLAnchorElement>(WORK_LINK_SELECTOR).forEach((link) => {
        const id = getArtworkId(link.href);
        const card = link.parentElement;
        if (!id || !card || card.hasAttribute(DONE_ATTR)) return;
        card.setAttribute(DONE_ATTR, '');

        if (getComputedStyle(card).position === 'static') {
            card.style.position = 'relative';
        }

        const button = createQuickButton('⏱ Later', async () => {
            const result = await queueWork(await fetchWork(id));
            return {
                status: result.status,
                undo: result.isNew ? () => unqueueWork(result.workId) : undefined,
            };
        });
        button.style.cssText = 'position: absolute; top: 6px; left: 6px; z-index: 1;';
        card.append(button);
    });
}

export function observeRecommendations(ctx: ContentScriptContext) {
    injectWorkButtons();

    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            injectWorkButtons();
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
}