# API endpoints

```text
/artists
├── POST   /artists                              [done]     add artist (find-or-create profile + UserArtist)
├── GET    /artists                              [done]     my artists (paging, ?status, ?platform, ?search)
├── GET    /artists/{id}                         [done]     artist card: profiles, my library entry (or null), my work counts
├── PATCH  /artists/{id}/status                  [done]     change status (Queued / Watching / Seen)
├── PATCH  /artists/{id}/note                    [done]     set or clear my note on artist (null or empty clears, max 1024 chars)
├── DELETE /artists/{id}                         [done]     remove artist from my library (deletes UserArtist, not Artist)
├── POST   /artists/{id}/profiles                [backlog]  attach a profile from another platform to this artist
├── POST   /artists/{id}/merge/{otherId}         [backlog]  merge two artists into one
└── GET    /artists/lookup?platform=&externalId= [backlog]  "do I already have this profile?" (for the extension)

/works
├── POST   /works                                [done]     save work (profile + Work + UserWork, no UserArtist)
├── GET    /works                                [done]     my works (paging, ?status, ?platform, ?artistId, ?search)
├── GET    /works/{id}                           [done]     work card: my library entry (or null), artist
├── PATCH  /works/{id}/status                    [done]     change status (Queued / Liked / Disliked)
├── DELETE /works/{id}                           [done]     remove work from my library (deletes UserWork)
└── GET    /works/lookup                         [done]     "is this work / its artist in my library?" (for the extension)
           ?platform=&externalId=&artistExternalId=          artistExternalId optional; response { work, artist }, each may be null

/library
└── POST   /library/lookup                       [done]     which of these works / artists are in my library (batch, for the extension)
           { platform, works: [externalId], artists: [externalId] }  max 100 each; response maps externalId → { id, status }

/me
├── GET    /me                                   [backlog]  current user
└── GET    /me/stats                             [backlog]  stats: artist and work counts by status

/auth                                                       anonymous; all other endpoints require a token
├── POST   /auth/google                          [done]     sign in with a Google ID token, issue tokens (creates the user on first sign-in)
├── POST   /auth/refresh                         [done]     exchange a refresh token for a new pair (rotation)
├── POST   /auth/logout                          [done]     revoke a refresh token, always 204
└── POST   /auth/dev                             [done]     Development only: issue tokens for the dev user, no body
```

Legend: `[done]` implemented, `[wip]` in progress, `[mvp]` required for MVP, `[backlog]` later.

## Conventions

- `/artists` and `/works` operate on the current user's library (`UserArtist` / `UserWork`).
  `DELETE` removes only the user's link; `Artist` and `Work` stay in the shared catalog.
  Exceptions: `profiles` and `merge` change the shared catalog itself.
- `GET /artists/{id}` and `GET /works/{id}` read from the shared catalog: they return any known entry,
  with `library: null` if it is not in the user's library. `404` means it does not exist at all.
- `PATCH` and `DELETE` operate on the user's library only: `404` means "not in your library".
  `DELETE` returns `204 No Content`.
- `lookup` endpoints always return `200`: "not in my library" is a normal answer (`null` fields), not `404`.
  `POST /library/lookup` returns only the entries found: a missing key means "not in my library".
  Ids are matched per platform; blanks and duplicates are ignored. Artists are matched by profile `externalId`
  and return the status of the artist that profile belongs to.
  `GET /works/lookup` resolves the artist by `artistExternalId` independently of the work,
  so a new, unsaved work by an artist I follow still reports the artist's status.
- Manual test requests live in `backend/ArtDoomscroll.API/Http/` (`artists.http`, `works.http`, `library.http`, `auth.http`).
- Re-saving an existing artist or work never resets its status; status changes only when `status` is passed explicitly.
- `POST` returns `201 Created` for a new entry in the user's library, `200 OK` if it was already there.
- List filters are optional and combined with AND; no filter means no restriction.
  `?search=` is case-insensitive (works: title, artist name, handle; artists: name, any profile's handle or display name).
  Paging: `?page=` (1-based) and `?pageSize=` (1..100, default 10); responses are wrapped in `Page<T>`.
- Validation errors return `400` ProblemDetails with camelCase keys; nested fields use dot notation (`artist.externalId`).

## Authentication

- Every endpoint requires `Authorization: Bearer <accessToken>` (fallback policy), except `/auth/*` and, in Development,
  OpenAPI and Scalar. A missing, invalid or expired access token returns `401`.
- Sign-in is Google only. `POST /auth/google { idToken }` validates the ID token against `Google:ClientIds`
  (one client per app: extension, site) and finds the user by Google `sub`, creating it on first sign-in.
  Name, email and avatar are refreshed from Google on every sign-in.
- `/auth/google`, `/auth/refresh` and `/auth/dev` return `{ accessToken, accessTokenExpiresAt, refreshToken }`.
- **Access token:** JWT (HS256), 15 minutes, `sub` = user id. Stateless: it stays valid until it expires,
  even after logout.
- **Refresh token:** random, 30 days, stored only as a SHA-256 hash. A user can have several (one per device).
  - Rotation: every successful `/auth/refresh` revokes the token it was given and issues a new pair.
  - Reuse detection: presenting an already revoked token revokes **all** of the user's refresh tokens and returns `401`.
    Clients must therefore never send the same refresh token twice, including in parallel requests:
    run one refresh at a time and let other requests wait for its result.
  - Any refresh failure (unknown, revoked, expired) returns the same `401`: the client signs in again.
- `POST /auth/logout { refreshToken }` revokes that token and always returns `204`, also for unknown or already
  revoked tokens.
- Settings: `Jwt` (`Issuer`, `Audience`, `SigningKey`, lifetimes) and `Google:ClientIds`, validated on startup.
  `Jwt:SigningKey` lives in User Secrets (production: env var `Jwt__SigningKey`), never in `appsettings.json`.
  Google client ids are public and live in `appsettings.json`.
- Manual tests: run `POST /auth/dev` first in each `.http` file; `auth.http` covers rotation, reuse detection and logout.
