import { sendMessage, type WorkStatus } from '@/utils/messaging';
import { getState, setState } from '@/utils/state';

export async function saveCurrentWork(status?: WorkStatus) {
    const { work, save } = getState();
    if (!work || save.kind === 'saving') return;

    setState({ save: { kind: 'saving' } });
    try {
        const result = await sendMessage('saveWork', { work, status });
        if (getState().work?.externalId !== work.externalId) return;
        setState({ save: { kind: 'saved', workId: result.workId, status: result.status } });
    } catch (e) {
        if (getState().work?.externalId !== work.externalId) return;
        setState({ save: { kind: 'error', message: String(e) } });
    }
}