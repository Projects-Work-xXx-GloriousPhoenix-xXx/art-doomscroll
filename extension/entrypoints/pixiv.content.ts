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
                setState({ work: null, save: { kind: 'idle' }, artistStatus: null });
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
            setState({ work, save: { kind: 'checking' }, artistStatus: null });

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
                setState({ save: { kind: 'idle' } });
                return;
            }
            
            if (getArtworkId(location.href) !== id) return;
            setState({
                save: result.work
                    ? { kind: 'saved', workId: result.work.workId, status: result.work.status }
                    : { kind: 'idle' },
                artistStatus: result.artist?.status ?? null
            })
        }

        handle(location.href);
        ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => handle(newUrl.href));
    },
});

