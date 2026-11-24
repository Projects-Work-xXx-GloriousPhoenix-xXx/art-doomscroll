import { handleHotkey } from "@/utils/hotkeys";
import { fetchWork, getArtworkId, type WorkPayload } from "@/utils/pixiv/api";
import { handleFacadeClick } from "@/utils/pixiv/facade";
import { createPanel } from "@/components/panel/panel";
import { observeRecommendations } from "@/utils/pixiv/cards";
import { storage } from 'wxt/utils/storage';
import { isNotSignedIn } from '@/utils/errors';
import { sendMessage, type LookupWorkResult } from "@/utils/messaging";
import { getState, setState } from "@/utils/state";

export default defineContentScript({
    matches: ['*://www.pixiv.net/*'],
    cssInjectionMode: 'ui',
    async main(ctx) {
        const user = await sendMessage('getUser').catch(() => undefined);
        setState({ signedOut: user === null });

        await createPanel(ctx);
        observeRecommendations(ctx);
        handleChangeLocation(location.href);

        ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => handleChangeLocation(newUrl.href));
        ctx.addEventListener(window, 'keydown', (e) => handleHotkey(e))
        ctx.addEventListener(document, 'click', (e) => handleFacadeClick(e), { capture: true });

        const unwatch = storage.watch('local:session', (session, previous) => {
            if (!!session === !!previous) return;
            if (session) {
                setState({ signedOut: false });
                handleChangeLocation(location.href);
            } else {
                setState({ signedOut: true });
            }
        });
        ctx.onInvalidated(unwatch);
    },
});

async function handleChangeLocation(url: string) {
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
    if (getState().signedOut) {
        setState({ work, save: { kind: 'idle' }, artist: { kind: 'none' } });
        return;
    }

    setState({ work, save: { kind: 'checking' }, artist: { kind: 'checking' } });

    let result: LookupWorkResult;
    try {
        result = await sendMessage('lookupWork', {
            platform: work.platform,
            externalId: work.externalId,
            artistExternalId: work.artist.externalId
        });
    }
    catch(e) {
        if (getArtworkId(location.href) !== id) return;
        if (isNotSignedIn(e)) {
            setState({ signedOut: true, save: { kind: 'idle' }, artist: { kind: 'none' } });
            return;
        }
        setState({ save: { kind: 'idle' }, artist: { kind: 'none' } });
        return;
    }

    if (getArtworkId(location.href) !== id) return;
    setState({
        signedOut: false,
        save: result.work
            ? { kind: 'saved', workId: result.work.workId, status: result.work.status }
            : { kind: 'idle' },
        artist: result.artist
            ? { kind: 'saved', artistId: result.artist.artistId, status: result.artist.status }
            : { kind: 'none' },
    })
}
