import '@/components/panel.css';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { type ArtistState, type PageState, type SaveState, subscribe } from '@/utils/state';
import { setArtistStatus, setWorkStatus } from '@/utils/actions';
import type { ArtistStatus, WorkStatus } from '@/utils/types';

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
                    <div class="artist-actions">
                        <button data-artist-status="Queued" class="queue" title="Check later">⏱ Later</button>
                        <button data-artist-status="Watching" class="follow" title="Follow">★ Follow</button>
                        <button data-artist-status="Seen" class="seen" title="Seen">✓ Seen</button>
                    </div>
                    <div class="actions">
                        <button data-status="Queued" class="queue" title="Later">⏱ Later</button>
                        <button data-status="Liked" class="like" title="Like">♥ Like</button>
                        <button data-status="Disliked" class="dislike" title="Dislike">✕ Dislike</button>
                    </div>
                    <div class="hint"></div>
                </div>
            `;

            container.querySelector('.actions')!.addEventListener('click', (e) => {
                const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-status]');
                if (!button) return;
                setWorkStatus(button.dataset.status as WorkStatus);
            });

            container.querySelector('.artist-actions')!.addEventListener('click', (e) => {
                const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-artist-status]');
                if (!button) return;
                setArtistStatus(button.dataset.artistStatus as ArtistStatus);
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
        root.querySelector('.artist')!.textContent = `by ${name}`;

        const busy = s.save.kind === 'checking' || s.save.kind === 'saving';
        const current = s.save.kind === 'saved' || s.save.kind === 'saving' ? s.save.status : null;
        root.querySelectorAll<HTMLButtonElement>('button[data-status]').forEach((b) => {
            b.disabled = busy;
            b.classList.toggle('active', b.dataset.status === current);
            b.setAttribute('aria-pressed', String(b.dataset.status === current));
        });

        const artistBusy = s.artist.kind === 'checking' || s.artist.kind === 'saving';
        const artistCurrent = s.artist.kind === 'saved' || s.artist.kind === 'saving' ? s.artist.status : null;
        root.querySelectorAll<HTMLButtonElement>('button[data-artist-status]').forEach((b) => {
            b.disabled = artistBusy;
            b.classList.toggle('active', b.dataset.artistStatus === artistCurrent);
            b.setAttribute('aria-pressed', String(b.dataset.artistStatus === artistCurrent));
        });

        root.querySelector('.hint')!.textContent = hintFor(s.save) || hintFor(s.artist);
    }

    subscribe(render);
}

function hintFor(s: SaveState | ArtistState): string {
    switch (s.kind) {
        case 'checking': return 'Checking…';
        case 'saving':   return 'Saving…';
        case 'error':    return 'Error — try again';
        case 'idle':
        case 'none':
        case 'saved':    return '';
        default: { const _: never = s; return ''; }
    }
}