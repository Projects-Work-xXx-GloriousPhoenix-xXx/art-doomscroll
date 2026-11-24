# Browser extension

Chrome extension (WXT, TypeScript, Manifest V3) for saving works and artists while browsing.
Currently supports Pixiv:

- **Panel** on an artwork page (`/artworks/{id}`, `/en/artworks/{id}`): the work and its artist,
  their status in my library, buttons to set or remove both.
- **Hotkeys** for the same actions.
- **Facade**: Pixiv's own bookmark and Follow buttons (on the artwork and in carousels) also save to my library.
- **Later buttons** on work thumbnails and artist cards anywhere on Pixiv (recommendations, author's works,
  feeds, profiles): save for later without opening the page.
- **Popup** (toolbar icon): sign in with Google, see the current account, sign out.

```text
┌──────────────────────────────────────────┐
│ Night city                            ⌨  │   ⌨ hover: hotkey list
│ by Artist B                              │
│ [ ⏱ Later ] [ ★ Follow ] [ ✓ Seen ]   ◌  │   artist: Queued / Watching / Seen
│ [ ⏱ Later ] [ ♥ Like ] [ ✕ Dislike ]  ⚠  │   work:   Queued / Liked / Disliked
└──────────────────────────────────────────┘
                                         ◌ request in progress, ⚠ error (hover for details)
```

Signed out, the panel still shows the title and artist (they come from Pixiv), but the button rows are replaced
with "Sign in via the extension popup to save works and artists".

## Setup

1. Run the backend with the `http` profile (`http://localhost:5256`).
2. Create `extension/.env` from the template:

   ```powershell
   Copy-Item extension/.env.example extension/.env
   ```

   | Variable | Value |
   |---|---|
   | `WXT_API_URL` | API base URL. Its origin is added to `host_permissions` in `wxt.config.ts` |
   | `WXT_GOOGLE_CLIENT_ID` | Google OAuth client id (see [Authentication](#authentication)); must also be in the backend `Google:ClientIds` |

   The build fails if either is not set.
3. Install and run:

   ```powershell
   cd extension
   npm install
   npm run dev
   ```

   WXT opens a separate Chrome profile with the extension loaded.
4. Open the popup (toolbar icon) and sign in with Google. The account must be a test user of the Google app
   while it is in Testing mode.

`WXT_*` variables are inlined into the extension bundle and readable by anyone who installs it.
Never put secrets there. The Google client id is public; the client secret is not used and must not be added.

Type check: `npm run compile` (`tsc --noEmit`).

## Dev workflow

- Changes to content scripts, background and components are rebuilt and reloaded automatically.
- Changes to `wxt.config.ts` or anything that affects the manifest require restarting `npm run dev`.
- F5 reloads the page, not the extension. To reload the extension press Alt+R (WXT dev shortcut).
- `chrome-extension://invalid/` in the page console means an orphaned content script left after the extension
  was reloaded. Reload the page; if it persists, restart `npm run dev`.
- Logs:
  - content script, panel, cards: DevTools of the Pixiv page;
  - background: `chrome://extensions` → art-doomscroll → "service worker" link (its Network tab shows API calls);
  - popup: right click inside the popup → Inspect.
- Session in storage: in the service worker console, `await chrome.storage.local.get('session')`.
  `await chrome.storage.local.remove('session')` signs out locally without calling the backend.
- HTTPS redirection is disabled in Development on the backend: a redirect to `https://localhost:7217` would break
  requests, since only the `WXT_API_URL` origin is in `host_permissions`.
- WXT auto-imports everything exported from `utils/`, so a missing import still works at runtime and may silently
  turn a type into `any`. Keep imports explicit.

## Architecture

```text
Pixiv page                                          Extension
┌─────────────────────────────────────┐  sendMessage  ┌──────────────┐  apiFetch  ┌─────┐
│ content script                      │ ────────────> │ background   │ ─────────> │ API │
│  pixiv/api   (/ajax/illust, /user)  │ <──────────── │ (service     │ <───────── │     │
│  state ─> panel (Shadow DOM)        │    result     │  worker)     │            └─────┘
│  hotkeys, facade ─> actions         │               │  auth        │ launchWebAuthFlow
│  cards ─> quick buttons ─> actions  │               │  tokens in   │ ─────────> Google
└─────────────────────────────────────┘               │  storage     │
                                       sendMessage    │              │
                          popup ────────────────────> │              │
                                                      └──────────────┘
```

| File | Role |
|---|---|
| `entrypoints/pixiv.content.ts` | Pixiv content script: wires everything up, tracks SPA navigation, runs lookup, fills state |
| `entrypoints/background.ts` | Message handlers; the only place that calls the API |
| `entrypoints/popup/` | Popup: account, sign in, sign out |
| `utils/auth.ts` | Background only: `signIn`, `signOut`, `getUser`, `apiFetch` (token, refresh, retry) |
| `utils/errors.ts` | `NotSignedInError`, `ApiError`, `isNotSignedIn(e)`; shared by background and content script |
| `utils/pixiv/api.ts` | `getArtworkId(url)`, `fetchWork(id)`, `fetchArtist(userId)`: Pixiv data mapped to `WorkPayload` |
| `utils/pixiv/facade.ts` | `handleFacadeClick`: Pixiv's bookmark / Follow buttons (artwork and carousels) call actions |
| `utils/pixiv/cards.ts` | `observeRecommendations`: injects Later buttons into thumbnails and artist cards |
| `utils/hotkeys.ts` | `bindings`, `handleHotkey`, `describeBinding` |
| `utils/actions.ts` | User actions (see below) |
| `utils/state.ts` | Page state store: `getState`, `setState`, `subscribe`, `isBusy` |
| `utils/messaging.ts` | Typed message protocol (`ProtocolMap`) and result types |
| `utils/types.ts` | Types mirroring the API contract: `Platform`, `WorkStatus`, `ArtistStatus` |
| `components/panel/` | Panel UI: renders state, forwards clicks to `toggle*` actions |
| `components/quick-button/` | `createQuickButton(label, onClick)` → `{ element, markSaved }`: small button in its own shadow root, with undo |

Actions:

| Action | Used by | Does |
|---|---|---|
| `setWorkStatus`, `setArtistStatus` | hotkeys, facade | set status on the current page (POST if not saved, PATCH if saved) |
| `toggleWorkStatus`, `toggleArtistStatus` | panel | like `set*`, but clicking the active status calls `remove*` |
| `removeWork`, `removeArtist` | `toggle*` | DELETE from the library, state back to `idle` / `none` |
| `queueWork`, `queueArtist` | cards, facade | POST (status optional: cards send none, facade sends one), return the full result; do not touch page state |
| `unqueueWork`, `unqueueArtist` | cards, `remove*` | DELETE by id |
| `lookupLibrary` | cards | batch lookup by external ids, split into chunks of 100, results merged |

Key decisions:

- **API calls go through the background.** It has `host_permissions` for the API origin, so the backend needs no CORS.
  The content script only fetches Pixiv's own `/ajax/*` endpoints (same origin as the page).
- **Tokens never leave the background.** Popup and content script only send messages (`signIn`, `getUser`, ...);
  `auth.ts` is imported by the background only, the others import its types.
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
- `signedOut` (page-wide, starts `false` to avoid a flash of the hint): set when a request fails with
  `NotSignedInError`, cleared when `lookupWork` succeeds. While set, the panel shows the sign-in hint instead
  of the buttons, and `set*` actions return early (hotkeys do nothing).

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
   - On `NotSignedInError`: `signedOut: true`, the panel shows the sign-in hint.
   - On any other failure both fall back to `idle` / `none`, so saving is still possible.
   - On success: `signedOut: false`.
6. Signing in or out in the popup changes `local:session`; the content script watches it (`storage.watch`) and
   reacts only when the session appears or disappears, not on token refresh: sign in reruns
   `handleChangeLocation`, sign out sets `signedOut: true`. No page reload needed.

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

### Saved status on appearance

Each observer pass (`scan`) collects the ids of newly injected cards into `Map<externalId, QuickButton[]>`
(one id can appear in several carousels) and sends a single `lookupLibrary` for all of them.
Found entries get `markSaved(status)`: `✓ Liked`, disabled, no undo, the same as a click that returned `isNew: false`.

- Already processed cards (`data-ad-done`) are not looked up again, so scrolling sends requests only for new cards.
- `markSaved` does nothing if the button is busy or has a pending undo: a click made before the lookup returned wins.
- If the lookup fails, buttons stay `⏱ Later`; a click still shows the real status, since Later never downgrades.
  The error is logged as `[art-doomscroll] cards: lookup failed`.

## Authentication

Google sign-in, then the backend's own JWT pair. Backend side: see the Authentication section of [api.md](api.md).

### Google setup

- **Fixed extension id.** Google only redirects to pre-registered URIs, and the redirect URI contains the extension id.
  An unpacked extension's id depends on its folder path (it differs between `chrome-mv3-dev` and `chrome-mv3`),
  so `wxt.config.ts` sets the manifest `key` (a public RSA key); the id is derived from it and is the same everywhere.
  The private key is not needed and must not be committed.
- **OAuth client** of type *Web application* in Google Auth Platform, redirect URI `https://<extension-id>.chromiumapp.org/`
  (with the trailing slash; it must equal `browser.identity.getRedirectURL()`). The *Chrome Extension* client type
  does not fit: it works with `getAuthToken`, which returns a Google access token, while the backend needs an ID token.
- Manifest permissions: `identity` (`launchWebAuthFlow`, `getRedirectURL`) and `storage` (tokens).

### Sign in

1. The popup sends `signIn`; the background runs `browser.identity.launchWebAuthFlow` with
   `response_type=id_token`, `scope=openid email profile`, a random `nonce` and `prompt=select_account`.
2. Google redirects to `https://<id>.chromiumapp.org/#id_token=...`; Chrome hands that URL back.
3. The background decodes the ID token payload (no signature check: the backend does that) and checks `nonce`.
4. `POST /auth/google { idToken }` returns the token pair; it is stored with the user's name, email and picture
   (taken from the ID token) as `local:session`.

The popup closes as soon as the Google window takes focus, so its `await` never resolves; the background finishes
sign-in anyway, and the popup shows the account the next time it opens.

### Requests and refresh

`apiFetch(path, init)` adds `Authorization: Bearer <accessToken>` and:

- refreshes first if the access token expires in under 30 seconds;
- on `401` refreshes once and retries once;
- throws `NotSignedInError` if there is no session or refresh fails, `ApiError(status, body)` on other non-2xx.

Refresh rules (the backend revokes all sessions when a refresh token is reused):

- **One refresh at a time.** `refresh()` keeps the in-flight promise; parallel callers share it.
- It reads the refresh token from storage when it runs, so a request that hit `401` after someone else refreshed
  sends the new token, not the old one.
- The session is removed only on `401` from `/auth/refresh`. Network errors and `5xx` keep it, so a backend restart
  does not sign the user out.

### Sign out

`signOut` removes the session locally first, then calls `POST /auth/logout` without waiting for the result:
sign-out works offline, and the refresh token expires on its own if the call fails.

### Errors across contexts

`@webext-core/messaging` serializes errors to `{ name, message, stack, ...own fields }` and rebuilds a plain `Error`,
so `instanceof NotSignedInError` is always `false` outside the background. Check `isNotSignedIn(e)`, which
compares `name`. `errors.ts` is a separate file so the content script can use it without bundling `auth.ts`.

## Messages

Defined in `utils/messaging.ts`, handled in `entrypoints/background.ts`. See [api.md](api.md) for the endpoints.

| Message | API call |
|---|---|
| `getUser` | none: the stored user or `null` |
| `signIn` | Google, then `POST /auth/google` |
| `signOut` | `POST /auth/logout` |
| `lookupWork` | `GET /works/lookup` |
| `lookupLibrary` | `POST /library/lookup` |
| `saveWork` | `POST /works` (`status` optional) |
| `updateWorkStatus` | `PATCH /works/{id}/status` |
| `deleteWork` | `DELETE /works/{id}` |
| `addArtist` | `POST /artists` (`status` optional) |
| `updateArtistStatus` | `PATCH /artists/{id}/status` |
| `deleteArtist` | `DELETE /artists/{id}` |

All API handlers go through `apiFetch`, which throws `ApiError` (`API {status}: {body}`) on non-2xx responses and
`NotSignedInError` without a session; the caller catches it and sets `error` state or `signedOut`.
`DELETE` returns `204 No Content`, so its handlers do not call `res.json()`.

## Adding a platform

1. Add the value to `Platform` in `utils/types.ts` (must match the backend `Platform` enum).
2. Add `utils/<platform>/api.ts` returning `WorkPayload` with that `platform`; facade and cards are optional.
3. Add `entrypoints/<platform>.content.ts` with its `matches`, reusing `createPanel` and the same state flow.
4. If the content script cannot fetch data same-origin, add a background message and the host to `host_permissions`.

Background handlers, actions, state and components need no changes.

## Known limitations

- Pixiv selectors rely on analytics attributes (`gtm-*`, `data-click-label`, `data-ga4-label`); a Pixiv redesign
  can break the facade and cards. See [pixiv-dependencies.md](pixiv-dependencies.md) for every selector,
  internal endpoint and assumption, with a triage table.
- Cards get their status once, on appearance; later changes from the panel, the facade or another card
  with the same work are not reflected until the card is re-rendered or the page is reloaded.
- Changing an artist's status and immediately opening another work by the same artist may drop the response;
  the highlight is wrong until the next navigation. The data on the backend is correct.
- Signed out, only the panel shows a hint. Later buttons and the facade just log the error to the console,
  and cards get no saved status; reload the page after signing in.
- While the Google app is in Testing mode, only its test users can sign in.
- Pixiv images (`i.pximg.net`, thumbnails and avatars) require a `Referer` header; the site will need an image proxy.
- The panel appears only on artwork pages; artist profile pages (`/users/{id}`) have Later buttons only.

## Roadmap

- Cards react to changes made elsewhere on the page (panel, facade, other cards).
- Hide Later buttons and skip the facade while signed out; rescan cards after sign-in.
- `GET /artists/lookup` and a panel on artist profile pages.
- More platforms (X).
