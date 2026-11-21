import '@/components/panel.css';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { type PageState, subscribe } from '@/utils/state';
import { setWorkStatus } from '@/utils/actions';
import type { WorkStatus } from '@/utils/types';

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
                    <div class="actions">
                        <button data-status="Queued" class="queue" title="Later">⏱ Later</button>
                        <button data-status="Liked" class="like" title="Like">♥</button>
                        <button data-status="Disliked" class="dislike" title="Dislike">✕</button>
                    </div>
                    <div class="hint"></div>
                </div>
            `;

            container.querySelector('.actions')!.addEventListener('click', (e) => {
                const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-status]');
                if (!button) return;
                setWorkStatus(button.dataset.status as WorkStatus);
            });
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
        const name = s.work.artist.displayName ?? s.work.artist.externalId;
        const artistText = s.artistStatus ? `by ${name} · ${s.artistStatus}` : `by ${name}`;
        root.querySelector('.artist')!.textContent = artistText;

        const busy = s.save.kind === 'checking' || s.save.kind === 'saving';
        const current = s.save.kind === 'saved' || s.save.kind === 'saving' ? s.save.status : null;

        root.querySelectorAll<HTMLButtonElement>('button[data-status]').forEach((b) => {
            b.disabled = busy;
            b.classList.toggle('active', b.dataset.status === current);
            b.setAttribute('aria-pressed', String(b.dataset.status === current));
        });

        const hint = root.querySelector('.hint')!;
        switch (s.save.kind) {
            case 'checking': hint.textContent = 'Checking…'; break;
            case 'saving':   hint.textContent = 'Saving…'; break;
            case 'error':    hint.textContent = 'Error — try again'; break;
            case 'idle':
            case 'saved':    hint.textContent = ''; break;
            default: { const _: never = s.save; }
        }
    }

    subscribe(render);
}
