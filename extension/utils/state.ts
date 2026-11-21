import type { WorkPayload } from '@/utils/pixiv';
import type { ArtistStatus, WorkStatus } from '@/utils/types';

export type SaveState =
    | { kind: 'checking' }
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'saved'; workId: string; status: WorkStatus }
    | { kind: 'error'; message: string };

export interface PageState {
    work: WorkPayload | null;
    save: SaveState;
    artistStatus: ArtistStatus | null;
}

let state: PageState = { work: null, save: { kind: 'idle' }, artistStatus: null };
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