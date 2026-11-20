export default defineContentScript({
    matches: ['*://*.pixiv.net/*'],
    main(ctx) {
        handle(location.href);

        ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
            handle(newUrl.href);
        });
    },
});

function getArtworkId(url: string): string | null {
    const match = new URL(url).pathname.match(/^\/(?:en\/)?artworks\/(\d+)/);
    return match?.[1] ?? null;
}

async function handle(url: string) {
    const id = getArtworkId(url);
    if (!id) return;

    const res = await fetch(`/ajax/illust/${id}`);
    const json = await res.json();
    console.log('[art-doomscroll]', json.body);
}