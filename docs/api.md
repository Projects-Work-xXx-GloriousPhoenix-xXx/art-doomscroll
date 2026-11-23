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

/auth
├── POST   /auth/google                          [backlog]  sign in with Google, issue JWT
└── POST   /auth/refresh                         [backlog]  refresh token
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
- Manual test requests live in `backend/ArtDoomscroll.API/Http/` (`artists.http`, `works.http`, `library.http`).
- Re-saving an existing artist or work never resets its status; status changes only when `status` is passed explicitly.
- `POST` returns `201 Created` for a new entry in the user's library, `200 OK` if it was already there.
- List filters are optional and combined with AND; no filter means no restriction.
  `?search=` is case-insensitive (works: title, artist name, handle; artists: name, any profile's handle or display name).
  Paging: `?page=` (1-based) and `?pageSize=` (1..100, default 10); responses are wrapped in `Page<T>`.
- Validation errors return `400` ProblemDetails with camelCase keys; nested fields use dot notation (`artist.externalId`).
