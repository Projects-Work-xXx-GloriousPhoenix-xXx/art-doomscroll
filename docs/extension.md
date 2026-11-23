# Browser extension

Chrome extension (WXT, TypeScript, Manifest V3) for saving works and artists while browsing.
Currently supports Pixiv:

- **Panel** on an artwork page (`/artworks/{id}`, `/en/artworks/{id}`): the work and its artist,
  their status in my library, buttons to set or remove both.
- **Hotkeys** for the same actions.
- **Facade**: Pixiv's own bookmark and Follow buttons (on the artwork and in carousels) also save to my library.
- **Later buttons** on work thumbnails and artist cards anywhere on Pixiv (recommendations, author's works,
  feeds, profiles): save for later without opening the page.

```text
┌──────────────────────────────────────────┐
│ Night city                            ⌨  │   ⌨ hover: hotkey list
│ by Artist B                              │
│ [ ⏱ Later ] [ ★ Follow ] [ ✓ Seen ]   ◌  │   artist: Queued / Watching / Seen
│ [ ⏱ Later ] [ ♥ Like ] [ ✕ Dislike ]  ⚠  │   work:   Queued / Liked / Disliked
└──────────────────────────────────────────┘
                                         ◌ request in progress, ⚠ error (hover for details)
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
  - content script, panel, cards: DevTools of the Pixiv page;
  - background: `chrome://extensions` → art-doomscroll → "service worker" link (its Network tab shows API calls).
- HTTPS redirection is disabled in Development on the backend: a redirect to `https://localhost:7217` would break
  requests, since only the `WXT_API_URL` origin is in `host_permissions`.
- WXT auto-imports everything exported from `utils/`, so a missing import still works at runtime and may silently
  turn a type into `any`. Keep imports explicit.

## Architecture

```text
Pixiv page                                          Extension
┌─────────────────────────────────────┐  sendMessage  ┌──────────────┐   fetch   ┌─────┐
│ content script                      │ ────────────> │ background   │ ────────> │ API │
│  pixiv/api   (/ajax/illust, /user)  │ <──────────── │ (service     │ <──────── │     │
│  state ─> panel (Shadow DOM)        │    result     │  worker)     │           └─────┘
│  hotkeys, facade ─> actions         │               └──────────────┘
│  cards ─> quick buttons ─> actions  │
└─────────────────────────────────────┘
```

| File | Role |
|---|---|
| `entrypoints/pixiv.content.ts` | Pixiv content script: wires everything up, tracks SPA navigation, runs lookup, fills state |
| `entrypoints/background.ts` | Message handlers; the only place that calls the API |
| `utils/pixiv/api.ts` | `getArtworkId(url)`, `fetchWork(id)`, `fetchArtist(userId)`: Pixiv data mapped to `WorkPayload` |
| `utils/pixiv/facade.ts` | `handleFacadeClick`: Pixiv's bookmark / Follow buttons (artwork and carousels) call actions |
| `utils/pixiv/cards.ts` | `observeRecommendations`: injects Later buttons into thumbnails and artist cards |
| `utils/hotkeys.ts` | `bindings`, `handleHotkey`, `describeBinding` |
| `utils/actions.ts` | User actions (see below) |
| `utils/state.ts` | Page state store: `getState`, `setState`, `subscribe`, `isBusy` |
| `utils/messaging.ts` | Typed message protocol (`ProtocolMap`) and result types |
| `utils/types.ts` | Types mirroring the API contract: `Platform`, `WorkStatus`, `ArtistStatus` |
| `components/panel/` | Panel UI: renders state, forwards clicks to `toggle*` actions |
| `components/quick-button/` | `createQuickButton(label, onClick)`: small button in its own shadow root, with undo |

Actions:

| Action | Used by | Does |
|---|---|---|
| `setWorkStatus`, `setArtistStatus` | hotkeys, facade | set status on the current page (POST if not saved, PATCH if saved) |
| `toggleWorkStatus`, `toggleArtistStatus` | panel | like `set*`, but clicking the active status calls `remove*` |
| `removeWork`, `removeArtist` | `toggle*` | DELETE from the library, state back to `idle` / `none` |
| `queueWork`, `queueArtist` | cards, facade | POST (status optional: cards send none, facade sends one), return the full result; do not touch page state |
| `unqueueWork`, `unqueueArtist` | cards, `remove*` | DELETE by id |

Key decisions:

- **API calls go through the background.** It has `host_permissions` for the API origin, so the backend needs no CORS.
  The content script only fetches Pixiv's own `/ajax/*` endpoints (same origin as the page).
- **Content scripts know the site, the background and actions do not.** Pixiv code (`utils/pixiv/`) builds
  a `WorkPayload` with its `platform`; messages and actions carry the platform and stay platform-agnostic.
- **One state, one direction.** Content script and actions write state; the panel only renders it.
  Panel, hotkeys and facade are different entry points to the same actions.
- **Work and artist are independent.** `SaveState` and `ArtistState` are separate discriminated unions,
  so both rows can be busy at the same time, each with its own progress and error.
- **Stale responses are dropped.** After every `await` (success or failure) the code checks that the user is still
  on the same work (`getArtworkId(location.href)` or `getState().work?.externalId`) before writing state.
- **Shadow DOM everywhere we inject UI.** The panel uses `createShadowRootUi` (`cssInjectionMode: 'ui'`);
  quick buttons attach their own shadow root and load styles with `?inline`, because CSS imported normally
  is bundled into the panel's shadow root only.

### State

```ts
SaveState   = checking | idle | saving { status } | saved { workId, status }   | removing | error { message }
ArtistState = checking | none | saving { status } | saved { artistId, status } | removing | error { message }
```

- `idle` / `none` mean "not in my library".
- `saving` carries the target status so its button is highlighted immediately (optimistic highlight);
  on error the highlight is dropped.
- `isBusy` (`checking`, `saving`, `removing`) disables the row and shows the spinner.

### Artist data

`fetchWork` takes the artist from `fetchArtist` (`/ajax/user/{id}?full=0`): `name`, `pixivId` (handle) and
`imageBig` (170px avatar). `/ajax/illust` has no reliable avatar field. If `/ajax/user` fails, the artist is built
from the illust fields without an avatar, so saving still works.

## Page lifecycle

1. `main` creates the panel, starts card observation, registers hotkeys and the facade, then calls
   `handleChangeLocation(location.href)`; `wxt:locationchange` calls it again on SPA navigation.
2. Not an artwork URL: `work: null`, panel is removed.
3. `fetchWork(id)`; on failure `work: null`.
4. `work` set, `save` and `artist` set to `checking` (buttons disabled, spinner).
5. `lookupWork` → `GET /works/lookup?platform=&externalId=&artistExternalId=`:
   - `save`: `saved` if the work is in my library, otherwise `idle`;
   - `artist`: `saved` if the artist is in my library, otherwise `none`.
   - On failure both fall back to `idle` / `none`, so saving is still possible.

### Panel buttons

| State | Click on status X |
|---|---|
| `idle` / `none` / `error` | `POST /works` or `POST /artists` with status X |
| `saved`, status ≠ X | `PATCH /works/{workId}/status` or `PATCH /artists/{artistId}/status` |
| `saved`, status = X | `DELETE /works/{workId}` or `DELETE /artists/{artistId}` (tooltip "Click again to remove") |
| busy | buttons disabled |

After an error the id is lost, so the next click sends `POST`. That still works: the backend applies an explicit
status to an existing library entry.

Removing an artist deletes the whole `UserArtist`, including its note.

## Hotkeys

| | Queue | Like / Follow | Dislike / Seen |
|---|---|---|---|
| Work | `Q` | `L` | `D` |
| Artist | `Shift+Q` | `Shift+F` | `Shift+S` |

- Defined as data in `bindings`; the panel's ⌨ popup is generated from it.
- Matched by `event.code` (physical key), so they work in any keyboard layout.
- Ignored with Ctrl / Alt / Meta (browser shortcuts), on key repeat, and while typing in inputs.
- Hotkeys only set statuses, they never remove: pressing a key twice is harmless.

## Facade

Capture-phase click listener on `document`; Pixiv's own action still happens (no `preventDefault`).

| Pixiv control | Selector | Our action |
|---|---|---|
| Bookmark on the artwork | `button.gtm-main-bookmark` (exists only while not bookmarked) | work `Liked` |
| Bookmark on a carousel card | `[data-ga4-label="bookmark_button"] button` | `Liked` if not bookmarked yet, `Disliked` if the bookmark is being removed |
| Follow of any user | `button[data-click-label="follow"]`, user id from `data-gtm-user-id` | `Watching` if `data-variant="Primary"`, otherwise `Seen` |

- **Current work and artist** go through `setWorkStatus` / `setArtistStatus`, so the panel updates.
  Others are saved with `queueWork` / `queueArtist` and an explicit status, without touching page state.
- **Card work id**: the nearest `a[href*="/artworks/"]` found by walking up at most 4 levels from the bookmark
  button (further up would reach the carousel container and pick another card's link).
- **Card bookmark state**: the same button is used for both states, so it is read from the SVG's computed color
  (`rgb(255, 64, 96)` = bookmarked). The listener runs in the capture phase, before Pixiv, so it sees the state
  before the click.
- Requests are fire-and-forget; failures are logged to the page console as `[art-doomscroll] facade: ...`.

## Cards (Later buttons)

`observeRecommendations` scans the page on start and on every DOM change (`MutationObserver`, throttled to one pass
per animation frame, disconnected on `ctx.onInvalidated`). Processed cards are marked with `data-ad-done`.

| Target | Found by | Button | Click |
|---|---|---|---|
| Work thumbnail | `a[href*="/artworks/"]` containing `img` or `figure` (lazy placeholder) | top-left corner of the link's parent | `queueWork(await fetchWork(id))` |
| Artist card | `button[data-click-label="follow"]`, except the current work's author | right after the Follow button | `queueArtist('Pixiv', await fetchArtist(id))` |

- **Later sends no status.** A new entry gets the default `Queued`; an existing one keeps its status, and the button
  shows it (`✓ Liked`) and becomes disabled. Later never downgrades.
- **Undo** is offered only when this click created the entry (`isNew`): clicking `✓ Queued` deletes it.
- **Current work's card** stays in sync with the panel: Later updates the panel, and undo is refused
  if the status was changed in the panel since.
- Card data is fetched on click, not on injection, to avoid a request per visible card.

## Messages

Defined in `utils/messaging.ts`, handled in `entrypoints/background.ts`. See [api.md](api.md) for the endpoints.

| Message | API call |
|---|---|
| `lookupWork` | `GET /works/lookup` |
| `saveWork` | `POST /works` (`status` optional) |
| `updateWorkStatus` | `PATCH /works/{id}/status` |
| `deleteWork` | `DELETE /works/{id}` |
| `addArtist` | `POST /artists` (`status` optional) |
| `updateArtistStatus` | `PATCH /artists/{id}/status` |
| `deleteArtist` | `DELETE /artists/{id}` |

Handlers throw on non-2xx responses with `API {status}: {body}`; the caller catches it and sets `error` state.
`DELETE` returns `204 No Content`, so its handlers do not call `res.json()`.

## Adding a platform

1. Add the value to `Platform` in `utils/types.ts` (must match the backend `Platform` enum).
2. Add `utils/<platform>/api.ts` returning `WorkPayload` with that `platform`; facade and cards are optional.
3. Add `entrypoints/<platform>.content.ts` with its `matches`, reusing `createPanel` and the same state flow.
4. If the content script cannot fetch data same-origin, add a background message and the host to `host_permissions`.

Background handlers, actions, state and components need no changes.

## Known limitations

- Pixiv selectors rely on analytics attributes (`gtm-*`, `data-click-label`, `data-ga4-label`); a Pixiv redesign
  can break the facade and cards.
- Cards do not know the saved status until clicked, and panel actions do not update cards.
- Changing an artist's status and immediately opening another work by the same artist may drop the response;
  the highlight is wrong until the next navigation. The data on the backend is correct.
- No authentication yet: the backend uses `DevCurrentUser`.
- Pixiv images (`i.pximg.net`, thumbnails and avatars) require a `Referer` header; the site will need an image proxy.
- The panel appears only on artwork pages; artist profile pages (`/users/{id}`) have Later buttons only.

## Roadmap

- Batch lookup so cards show the saved status on appearance, and cards react to panel changes.
- `GET /artists/lookup` and a panel on artist profile pages.
- More platforms (X).
