import styles from './quick-button.css?inline';

export interface QuickResult {
    status: string;
    undo?: () => Promise<void>;
}

export interface QuickButton {
    element: HTMLElement;
    markSaved(status: string): void;
}

export function createQuickButton(label: string, onClick: () => Promise<QuickResult>): QuickButton {
    const host = document.createElement('span');
    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `<style>${styles}</style><button type="button"></button>`;

    const button = shadow.querySelector('button')!;
    button.textContent = label;

    let undo: (() => Promise<void>) | null = null;
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (button.disabled) return;

        button.disabled = true;
        button.textContent = '…';
        button.title = '';

        try {
            if (undo) {
                await undo();
                undo = null;
                button.textContent = label;
                button.disabled = false;
            } else {
                const result = await onClick();
                button.textContent = `✓ ${result.status}`;
                if (result.undo) {
                    undo = result.undo;
                    button.disabled = false;
                    button.title = 'Click to undo';
                }
            }
        } catch (err) {
            button.textContent = '⚠ Retry';
            button.title = String(err);
            button.disabled = false;
        }
    });

    return {
        element: host,
        markSaved(status) {
            if (button.disabled || undo) return;
            button.textContent = `✓ ${status}`;
            button.disabled = true;
        },
    };
}