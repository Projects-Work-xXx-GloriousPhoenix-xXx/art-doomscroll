import type { ArtistStatus, WorkStatus } from '@/utils/types';

export type LibraryChange =
    | { kind: 'work'; externalId: string; status: WorkStatus | null }
    | { kind: 'artist'; externalId: string; status: ArtistStatus | null };

const listeners = new Set<(change: LibraryChange) => void>();

export function onLibraryChange(listener: (change: LibraryChange) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function emitLibraryChange(change: LibraryChange): void {
    listeners.forEach((listener) => listener(change));
}