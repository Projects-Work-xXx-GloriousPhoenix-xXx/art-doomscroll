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

            const name = text('div', '', 'name');
            name.title = user.name;

            const email = text('div', '', 'muted');
            email.title = user.email;

            info.append(name, email);
            profile.append(info);

            app.replaceChildren(profile, button('Sign out', onSignOut));

            fitMiddle(name, user.name);
            fitEmail(email, user.email);
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

function fitMiddle(el: HTMLElement, text: string, suffix = '', tail = 3): void {
    const chars = [...text];
    const build = (head: number) =>
        chars.slice(0, head).join('') + '…' + chars.slice(-tail).join('') + suffix;

    el.textContent = text + suffix;
    if (el.scrollWidth <= el.clientWidth) return;
    if (chars.length <= tail + 1) return;

    let lo = 1;
    let hi = chars.length - tail - 1;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        el.textContent = build(mid);
        if (el.scrollWidth <= el.clientWidth) lo = mid;
        else hi = mid - 1;
    }
    el.textContent = build(lo);
}

function fitEmail(el: HTMLElement, email: string): void {
    const at = email.lastIndexOf('@');
    if (at < 0) fitMiddle(el, email);
    else fitMiddle(el, email.slice(0, at), email.slice(at));
}

render({ kind: 'loading' });
sendMessage('getUser').then(
    user => render(user ? { kind: 'signedIn', user } : { kind: 'signedOut' }),
    e => render({ kind: 'signedOut', error: e instanceof Error ? e.message : String(e) }),
);