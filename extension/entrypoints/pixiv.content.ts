import { handleHotkey } from "@/utils/hotkeys";
import { fetchArtist, fetchWork, getArtworkId, getUserId, type WorkPayload } from "@/utils/pixiv/api";
import { handleFacadeClick } from "@/utils/pixiv/facade";
import { createPanel } from "@/components/panel/panel";
import { observeRecommendations } from "@/utils/pixiv/cards";
import { storage } from 'wxt/utils/storage';
import { isNotSignedIn } from '@/utils/errors';
import { sendMessage, type LookupWorkResult } from "@/utils/messaging";
import { getState, setState } from "@/utils/state";
import { lookupLibrary } from "@/utils/actions";

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
    const userId = getUserId(url);
    if (userId) {
        await handleProfile(userId);
        return;
    }


    const id = getArtworkId(url);
    if (!id) {
        setState({ work: null, profile: null, save: { kind: 'idle' }, artist: { kind: 'none' } });
        return;
    }

    let work: WorkPayload;
    try {
        work = await fetchWork(id);
    }
    catch {
        if (getArtworkId(location.href) !== id) return;
        setState({ work: null, profile: null });
        return;
    }

    if (getArtworkId(location.href) !== id) return;
    if (getState().signedOut) {
        setState({ work, profile: null, save: { kind: 'idle' }, artist: { kind: 'none' } });
        return;
    }

    setState({ work, profile: null, save: { kind: 'checking' }, artist: { kind: 'checking' } });

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

async function handleProfile(userId: string) {
    let artist: WorkPayload['artist'];
    try {
        artist = await fetchArtist(userId);
    } catch {
        if (getUserId(location.href) !== userId) return;
        setState({ work: null, profile: null });
        return;
    }

    if (getUserId(location.href) !== userId) return;
    const profile = { platform: 'Pixiv' as const, artist };

    if (getState().signedOut) {
        setState({ work: null, profile, save: { kind: 'idle' }, artist: { kind: 'none' } });
        return;
    }
    setState({ work: null, profile, save: { kind: 'idle' }, artist: { kind: 'checking' } });

    try {
        const result = await lookupLibrary('Pixiv', [], [userId]);
        if (getUserId(location.href) !== userId) return;
        const found = result.artists[userId];
        setState({
            signedOut: false,
            artist: found ? { kind: 'saved', artistId: found.artistId, status: found.status } : { kind: 'none' },
        });
    } catch (e) {
        if (getUserId(location.href) !== userId) return;
        setState({ artist: { kind: 'none' }, ...(isNotSignedIn(e) ? { signedOut: true } : {}) });
    }
}