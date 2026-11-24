export class NotSignedInError extends Error {
    override name = 'NotSignedInError';
}

export class ApiError extends Error {
    override name = 'ApiError';
    constructor(public status: number, body: string) {
        super(`API ${status}: ${body}`);
    }
}

export function isNotSignedIn(e: unknown): boolean {
    return e instanceof Error && e.name === 'NotSignedInError';
}