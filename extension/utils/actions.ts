import { sendMessage } from '@/utils/messaging';
import type { WorkStatus } from '@/utils/types';
import { getState, setState } from '@/utils/state';

export async function setWorkStatus(status: WorkStatus) {
    const { work, save } = getState();
    if (!work || save.kind === 'saving' || save.kind === 'checking') return;
    if (save.kind === 'saved' && save.status === status) return;

    const workId = save.kind === 'saved' ? save.workId : null;
    setState({ save: { kind: 'saving', status } });

    try {
        if (workId !== null) {
            const result = await sendMessage('updateWorkStatus', { workId, status });
            if (getState().work?.externalId !== work.externalId) return;
            setState({ save: { kind: 'saved', workId, status: result.newStatus } });
        } else {
            const result = await sendMessage('saveWork', { work, status });
            if (getState().work?.externalId !== work.externalId) return;
            setState({
                save: { kind: 'saved', workId: result.workId, status: result.status },
                artistStatus: result.artistStatus,
            });
        }
    } catch (e) {
        if (getState().work?.externalId !== work.externalId) return;
        setState({ save: { kind: 'error', message: String(e) } });
    }
}