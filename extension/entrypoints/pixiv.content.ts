import { fetchWork, getArtworkId } from "@/utils/pixiv";
import { setState } from "@/utils/state";

export default defineContentScript({
    matches: ['*://www.pixiv.net/*'],
    cssInjectionMode: 'ui',
    async main(ctx) {
        await createPanel(ctx);
        
        async function handle(url: string) {
            const id = getArtworkId(url);
            if (!id) {
                setState({ work: null, save: { kind: 'idle' } });
                return;
            }

            const work = await fetchWork(id);
            setState({ work, save: { kind: 'idle' } });
        }

        handle(location.href);
        ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => handle(newUrl.href));
    },
});

