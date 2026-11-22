import type { LookupWorkResult } from "@/utils/messaging";
import { fetchWork, getArtworkId, type WorkPayload } from "@/utils/pixiv";
import { setState } from "@/utils/state";

export default defineContentScript({
    matches: ['*://www.pixiv.net/*'],
    cssInjectionMode: 'ui',
    async main(ctx) {
        await createPanel(ctx);
        
        async function handle(url: string) {
            const id = getArtworkId(url);
            if (!id) {
                setState({ work: null, save: { kind: 'idle' }, artist: { kind: 'none' } });
                return;
            }

            let work: WorkPayload;
            try {
                work = await fetchWork(id);
            }
            catch {
                if (getArtworkId(location.href) !== id) return;
                setState({ work: null });
                return;
            }

            if (getArtworkId(location.href) !== id) return;
            setState({ work, save: { kind: 'checking' }, artist: { kind: 'checking' } });

            let result: LookupWorkResult;
            try {
                result = await sendMessage('lookupWork', { 
                    platform: work.platform,
                    externalId: work.externalId,
                    artistExternalId: work.artist.externalId
                });
            }
            catch {
                if (getArtworkId(location.href) !== id) return;
                setState({ save: { kind: 'idle' }, artist: { kind: 'none' } });
                return;
            }
            
            if (getArtworkId(location.href) !== id) return;
            setState({
                save: result.work
                    ? { kind: 'saved', workId: result.work.workId, status: result.work.status }
                    : { kind: 'idle' },
                artist: result.artist
                    ? { kind: 'saved', artistId: result.artist.artistId, status: result.artist.status }
                    : { kind: 'none' },
            })
        }

        handle(location.href);
        ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => handle(newUrl.href));
    },
});

