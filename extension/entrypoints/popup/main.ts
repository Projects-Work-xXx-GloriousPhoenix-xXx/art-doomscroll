import './style.css';
import { sendMessage } from '@/utils/messaging';
import type { AuthUser } from '@/utils/auth';

type View =
    | { kind: 'loading' }
    | { kind: 'signedOut'; error?: string }
    | { kind: 'signingIn' }
    | { kind: 'signedIn'; user: AuthUser };

const app = document.querySelector<HTMLElement>('#app')!;

function render(view: View): void {
    switch (view.kind) {
        case 'loading':
            app.replaceChildren(text('p', 'Loading…', 'muted'));
            break;

        case 'signedOut':
            app.replaceChildren(
                ...(view.error ? [text('p', view.error, 'error')] : []),
                button('Sign in with Google', onSignIn),
            );
            break;

        case 'signingIn': {
            const b = button('Signing in…', () => {});
            b.disabled = true;
            app.replaceChildren(b);
            break;
        }

        case 'signedIn': {
            const { user } = view;
            const profile = document.createElement('div');
            profile.className = 'profile';

            if (user.picture) {
                const img = document.createElement('img');
                img.src = user.picture;
                img.alt = '';
                img.referrerPolicy = 'no-referrer';
                profile.append(img);
            }

            const info = document.createElement('div');
            info.append(text('div', user.name, 'name'), text('div', user.email, 'muted'));
            profile.append(info);

            app.replaceChildren(profile, button('Sign out', onSignOut));
            break;
        }
    }
}

async function onSignIn(): Promise<void> {
    render({ kind: 'signingIn' });
    try {
        const user = await sendMessage('signIn');
        render({ kind: 'signedIn', user });
    } catch (e) {
        render({ kind: 'signedOut', error: e instanceof Error ? e.message : String(e) });
    }
}

async function onSignOut(): Promise<void> {
    await sendMessage('signOut');
    render({ kind: 'signedOut' });
}

function text(tag: string, content: string, className?: string): HTMLElement {
    const el = document.createElement(tag);
    el.textContent = content;
    if (className) el.className = className;
    return el;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
}

render({ kind: 'loading' });
sendMessage('getUser').then(
    user => render(user ? { kind: 'signedIn', user } : { kind: 'signedOut' }),
    e => render({ kind: 'signedOut', error: e instanceof Error ? e.message : String(e) }),
);