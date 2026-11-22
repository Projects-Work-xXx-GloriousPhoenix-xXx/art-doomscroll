import type { WorkStatus, ArtistStatus } from "@/utils/types";
import { setWorkStatus, setArtistStatus } from "@/utils/actions";

type Binding =
    | { code: string; shift: boolean; target: 'work'; status: WorkStatus }
    | { code: string; shift: boolean; target: 'artist'; status: ArtistStatus };

export const bindings: Binding[] = [
    { code: 'KeyQ', shift: false, target: 'work',   status: 'Queued' },
    { code: 'KeyL', shift: false, target: 'work',   status: 'Liked' },
    { code: 'KeyD', shift: false, target: 'work',   status: 'Disliked' },
    { code: 'KeyQ', shift: true,  target: 'artist', status: 'Queued' },
    { code: 'KeyF', shift: true,  target: 'artist', status: 'Watching' },
    { code: 'KeyS', shift: true,  target: 'artist', status: 'Seen' },
];

export function handleHotkey(e: KeyboardEvent) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (isTyping(e.target)) return;

    const binding = bindings.find((b) => b.code === e.code && b.shift === e.shiftKey);
    if (!binding) return;

    e.preventDefault();
    if (binding.target === 'work') {
        setWorkStatus(binding.status);
    } else {
        setArtistStatus(binding.status);
    }
}

function isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}