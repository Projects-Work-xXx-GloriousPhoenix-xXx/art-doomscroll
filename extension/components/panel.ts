import '@/components/panel.css';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { type ArtistState, type PageState, type SaveState, subscribe } from '@/utils/state';
import { setArtistStatus, setWorkStatus } from '@/utils/actions';
import type { ArtistStatus, WorkStatus } from '@/utils/types';
import { bindings, describeBinding } from '@/utils/hotkeys';

export async function createPanel(ctx: ContentScriptContext) {
    const ui = await createShadowRootUi(ctx, {
        name: 'art-doomscroll-panel',
        position: 'overlay',
        anchor: 'body',
        onMount(container) {
            container.innerHTML = `
                <div class="panel">
                    <span class="help">⌨<div class="help-popup"></div></span>
                    <div class="title"></div>
                    <div class="artist"></div>
                    <div class="artist-actions">
                        <button data-artist-status="Queued" class="queue" title="Check later">⏱ Later</button>
                        <button data-artist-status="Watching" class="follow" title="Follow">★ Follow</button>
                        <button data-artist-status="Seen" class="seen" title="Seen">✓ Seen</button>
                        <span class="row-status"></span>
                    </div>
                    <div class="actions">
                        <button data-status="Queued" class="queue" title="Later">⏱ Later</button>
                        <button data-status="Liked" class="like" title="Like">♥ Like</button>
                        <button data-status="Disliked" class="dislike" title="Dislike">✕ Dislike</button>
                        <span class="row-status"></span>
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

            container.querySelector('.help-popup')!.innerHTML = bindings.map(describeBinding).join('<br>');
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

        setRowStatus(root.querySelector('.actions .row-status')!, s.save);
        setRowStatus(root.querySelector('.artist-actions .row-status')!, s.artist);
    }

    subscribe(render);
}

function setRowStatus(el: Element, s: SaveState | ArtistState) {
    el.classList.toggle('busy', s.kind === 'checking' || s.kind === 'saving');
    el.classList.toggle('error', s.kind === 'error');
    el.setAttribute('title', s.kind === 'error' ? s.message : '');
}