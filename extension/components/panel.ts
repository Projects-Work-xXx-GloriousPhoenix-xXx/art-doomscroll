import '@/components/panel.css';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { WorkPayload } from '@/utils/pixiv';
import { saveWork } from '@/utils/actions';

export async function createPanel(ctx: ContentScriptContext) {
    let current: WorkPayload | null = null;

    const ui = await createShadowRootUi(ctx, {
        name: 'art-doomscroll-panel',
        position: 'overlay',
        anchor: 'body',
        onMount(container) {
            container.innerHTML = `
                <div class="panel">
                    <div class="title"></div>
                    <div class="artist"></div>
                    <button class="save">Save</button>
                </div>
            `;
            container.querySelector('.save')!
                .addEventListener('click', async () => handleSave(current));
        },
    });

    return {
        show(work: WorkPayload) {
            current = work;
            ui.mount();
            const root = ui.uiContainer;
            root.querySelector('.title')!.textContent = work.title ?? '(untitled)';
            root.querySelector('.artist')!.textContent = `by ${work.artist.displayName ?? work.artist.externalId}`;
        },
        
        hide() {
            ui.remove();
        },
    };
}

async function handleSave(value: WorkPayload | null) {
    if (!value) return;
    try {
        const result = await saveWork(value);
        console.log('[art-doomscroll] saved', result);
    } catch(e) {
        console.error('[art-doomscroll] save failed', e);
    }
}