import { createPanel } from "@/components/panel";
import { fetchWork, getArtworkId } from "@/utils/pixiv";

export default defineContentScript({
    matches: ['*://www.pixiv.net/*'],
    cssInjectionMode: 'ui',
    async main(ctx) {
        const panel = await createPanel(ctx);
        async function handle(url: string) {
            const id = getArtworkId(url);
            if (!id) {
                panel.hide();
                return;
            }

            const work = await fetchWork(id);
            panel.show(work);
        }

        handle(location.href);
        ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => handle(newUrl.href));
    },
});

