import { fetchWork, getArtworkId } from "@/utils/pixiv";

export default defineContentScript({
    matches: ['*://*.pixiv.net/*'],
    main(ctx) {
        handle(location.href);

        ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
            handle(newUrl.href);
        });
    },
});

async function handle(url: string) {
    const id = getArtworkId(url);
    if (!id) return;

    const work = await fetchWork(id);
    console.log('[art-doomscroll]', work);
}