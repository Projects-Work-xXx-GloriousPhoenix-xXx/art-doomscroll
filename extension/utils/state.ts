import type { WorkPayload } from '@/utils/pixiv/api';
import type { ArtistStatus, WorkStatus } from '@/utils/types';

export type SaveState =
    | { kind: 'checking' }
    | { kind: 'idle' }
    | { kind: 'saving'; status: WorkStatus }
    | { kind: 'saved'; workId: string; status: WorkStatus }
    | { kind: 'error'; message: string };

export type ArtistState =
    | { kind: 'checking' }
    | { kind: 'none' }
    | { kind: 'saving'; status: ArtistStatus }
    | { kind: 'saved'; artistId: string; status: ArtistStatus }
    | { kind: 'error'; message: string };

export interface PageState {
    work: WorkPayload | null;
    save: SaveState;
    artist: ArtistState;
}

let state: PageState = { work: null, save: { kind: 'idle' }, artist: { kind: 'none' } };
const listeners = new Set<(s: PageState) => void>();

export function getState(): PageState {
    return state;
}

export function setState(patch: Partial<PageState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
}

export function subscribe(listener: (s: PageState) => void) {
    listeners.add(listener);
    listener(state); 
    return () => listeners.delete(listener);
}