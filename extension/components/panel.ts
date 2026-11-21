import '@/components/panel.css';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { type PageState, subscribe } from '@/utils/state';
import { saveCurrentWork } from '@/utils/actions';

export async function createPanel(ctx: ContentScriptContext) {
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
                .addEventListener('click', () => saveCurrentWork());
        },
    });

    let mounted = false;

    function render(s: PageState) {
        if (!s.work) {
            if (mounted) { ui.remove(); mounted = false; }
            return;
        }

        if (!mounted) { 
            ui.mount(); mounted = true;
        }

        const root = ui.uiContainer;
        root.querySelector('.title')!.textContent = s.work.title ?? '(untitled)';
        root.querySelector('.artist')!.textContent = `by ${s.work.artist.displayName ?? s.work.artist.externalId}`;

        const button = root.querySelector<HTMLButtonElement>('.save')!;
        switch (s.save.kind) {
            case 'idle': button.textContent = 'Save'; button.disabled = false; break;
            case 'saving': button.textContent = 'Saving…'; button.disabled = true; break;
            case 'saved': button.textContent = `Saved · ${s.save.status}`; button.disabled = true; break;
            case 'error': button.textContent = 'Retry'; button.disabled = false; break;
        }
    }

    subscribe(render);
}
