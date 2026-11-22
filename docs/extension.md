# Browser extension

Chrome extension (WXT, TypeScript, Manifest V3) for saving works and artists while browsing.
Currently supports Pixiv: on an artwork page (`/artworks/{id}`, `/en/artworks/{id}`) a panel in the bottom-right corner
shows the work and its artist, their status in my library, and buttons to change both.

```text
┌────────────────────────────────────────┐
│ Night city                             │
│ by Artist B                            │
│ [ ⏱ Later ] [ ★ Follow ] [ ✓ Seen ]  │   artist: Queued / Watching / Seen
│ [ ⏱ Later ] [ ♥ ] [ ✕ ]              │    work: Queued / Liked / Disliked
│ Saving…                                │   progress and errors
└────────────────────────────────────────┘
```

## Setup

1. Run the backend with the `http` profile (`http://localhost:5256`).
2. Create `extension/.env` from the template:

   ```powershell
   Copy-Item extension/.env.example extension/.env
   ```

   `WXT_API_URL` is the API base URL. Its origin is added to `host_permissions` in `wxt.config.ts`;
   the build fails if the variable is not set.
3. Install and run:

   ```powershell
   cd extension
   npm install
   npm run dev
   ```

   WXT opens a separate Chrome profile with the extension loaded.

`WXT_*` variables are inlined into the extension bundle and readable by anyone who installs it.
Never put secrets there.

Type check: `npm run compile` (`tsc --noEmit`).

## Dev workflow

- Changes to content scripts, background and components are rebuilt and reloaded automatically.
- Changes to `wxt.config.ts` or anything that affects the manifest require restarting `npm run dev`.
- F5 reloads the page, not the extension. To reload the extension press Alt+R (WXT dev shortcut).
- `chrome-extension://invalid/` in the page console means an orphaned content script left after the extension
  was reloaded. Reload the page; if it persists, restart `npm run dev`.
- Logs:
  - content script and panel: DevTools of the Pixiv page;
  - background: `chrome://extensions` → art-doomscroll → "service worker" link (its Network tab shows API calls).
- HTTPS redirection is disabled in Development on the backend: a redirect to `https://localhost:7217` would break
  requests, since only the `WXT_API_URL` origin is in `host_permissions`.

## Architecture

```text
Pixiv page                                   Extension
┌──────────────────────────────┐   sendMessage   ┌──────────────┐   fetch   ┌─────┐
│ content script               │ ──────────────> │ background   │ ────────> │ API │
│  fetchWork (/ajax/illust)    │ <────────────── │ (service     │ <──────── │     │
│  state ─> panel (Shadow DOM) │     result      │  worker)     │           └─────┘
└──────────────────────────────┘                 └──────────────┘
```


| File                               | Role                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `entrypoints/pixiv.content.ts`     | Pixiv content script: tracks SPA navigation, loads work data, runs lookup, fills state |
| `entrypoints/background.ts`        | Message handlers; the only place that calls the API                                    |
| `utils/pixiv.ts`                   | `getArtworkId(url)`, `fetchWork(id)`: Pixiv data mapped to `WorkPayload`               |
| `utils/messaging.ts`               | Typed message protocol (`ProtocolMap`) and result types                                |
| `utils/types.ts`                   | Types mirroring the API contract:`Platform`, `WorkStatus`, `ArtistStatus`              |
| `utils/state.ts`                   | Page state store:`getState`, `setState`, `subscribe`                                   |
| `utils/actions.ts`                 | User actions:`setWorkStatus`, `setArtistStatus`                                        |
| `components/panel.ts`, `panel.css` | Panel UI: renders state, forwards clicks to actions                                    |

Key decisions:

- **API calls go through the background.** It has `host_permissions` for the API origin, so the backend needs no CORS.
  The content script only fetches Pixiv's own `/ajax/illust/{id}` (same origin as the page).
- **Content scripts know the site, the background does not.** Each content script builds a `WorkPayload`
  with its own `platform`; messages carry the platform, so background handlers are platform-agnostic.
- **One state, one direction.** Content script and actions write state; the panel only renders it.
  Future entry points (hotkeys, a facade over Pixiv's own like button) call the same actions.
- **Work and artist are independent.** `SaveState` and `ArtistState` are separate discriminated unions,
  so both rows can be saving at the same time, each with its own progress and error.
- **Stale responses are dropped.** After every `await` (success or failure) the code checks that the user is still
  on the same work (`getArtworkId(location.href)` or `getState().work?.externalId`) before writing state.
- **Panel lives in Shadow DOM** (`createShadowRootUi`, `cssInjectionMode: 'ui'`): Pixiv styles do not leak in,
  panel styles do not leak out.

### State

```ts
SaveState   = checking | idle | saving { status } | saved { workId, status }   | error { message }
ArtistState = checking | none | saving { status } | saved { artistId, status } | error { message }
```

`idle` / `none` mean "not in my library". `saving` carries the target status so its button is highlighted
immediately (optimistic highlight); on error the highlight is dropped.

## Page lifecycle

1. `main` creates the panel and calls `handle(location.href)`; `wxt:locationchange` calls it again on SPA navigation.
2. Not an artwork URL: `work: null`, panel is removed.
3. `fetchWork(id)`; on failure `work: null`.
4. `work` set, `save` and `artist` set to `checking` (buttons disabled, hint "Checking…").
5. `lookupWork` → `GET /works/lookup?platform=&externalId=&artistExternalId=`:
   - `save`: `saved` if the work is in my library, otherwise `idle`;
   - `artist`: `saved` if the artist is in my library, otherwise `none`.
   - On failure both fall back to `idle` / `none`, so saving is still possible.

### Buttons


| State                     | Click on status X                                                    |
| ------------------------- | -------------------------------------------------------------------- |
| `idle` / `none` / `error` | `POST /works` or `POST /artists` with status X                       |
| `saved`, status ≠ X      | `PATCH /works/{workId}/status` or `PATCH /artists/{artistId}/status` |
| `saved`, status = X       | nothing                                                              |
| `checking` / `saving`     | buttons disabled                                                     |

After an error the id is lost, so the next click sends `POST`. That still works: the backend applies an explicit
status to an existing library entry.

## Messages

Defined in `utils/messaging.ts`, handled in `entrypoints/background.ts`. See [api.md](api.md) for the endpoints.


| Message              | API call                     |
| -------------------- | ---------------------------- |
| `lookupWork`         | `GET /works/lookup`          |
| `saveWork`           | `POST /works`                |
| `updateWorkStatus`   | `PATCH /works/{id}/status`   |
| `addArtist`          | `POST /artists`              |
| `updateArtistStatus` | `PATCH /artists/{id}/status` |

Handlers throw on non-2xx responses with `API {status}: {body}`; the caller catches it and sets `error` state.

## Adding a platform

1. Add the value to `Platform` in `utils/types.ts` (must match the backend `Platform` enum).
2. Add `utils/<platform>.ts` returning `WorkPayload` with that `platform`.
3. Add `entrypoints/<platform>.content.ts` with its `matches`, reusing `createPanel` and the same state flow.
4. If the content script cannot fetch data same-origin, add a background message and the host to `host_permissions`.

Background handlers, actions and the panel need no changes.

## Known limitations

- Changing an artist's status and immediately opening another work by the same artist may drop the response;
  the highlight is wrong until the next navigation. The data on the backend is correct.
- No authentication yet: the backend uses `DevCurrentUser`.
- Pixiv thumbnails (`i.pximg.net`) require a `Referer` header; the site will need an image proxy.
- Only artwork pages are handled; artist profile pages (`/users/{id}`) are not.

## Roadmap

- Hotkeys for work and artist statuses.
- Facade over Pixiv's own like button (capture-phase click listener calling `setWorkStatus`).
- `GET /artists/lookup` and a panel on artist profile pages.
- Batch lookup for feed pages.
- More platforms (X).
