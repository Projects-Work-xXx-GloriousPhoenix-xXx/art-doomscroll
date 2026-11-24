# Pixiv dependencies

Everything in the extension that relies on Pixiv's markup or internal API, and therefore can break when Pixiv
changes its site. Use it to triage reports like "the panel / buttons stopped working on Pixiv".

All Pixiv-specific code lives in `extension/utils/pixiv/` and `extension/entrypoints/pixiv.content.ts`.
Shared code (`actions`, `state`, `messaging`, `background`, `components`) does not touch Pixiv's DOM.

## Quick triage

| Symptom | Most likely cause | Look at |
|---|---|---|
| Panel does not appear on an artwork page | artwork URL format changed | `getArtworkId` regex in `utils/pixiv/api.ts` |
| Panel appears, but stays empty / disappears | `/ajax/illust` response changed or fails | `fetchWork`, `PixivIllust` in `utils/pixiv/api.ts` |
| Saved artist has no handle / avatar | `/ajax/user` response changed or fails (fallback hides it) | `fetchArtist`, `PixivUser` in `utils/pixiv/api.ts` |
| Bookmark on the artwork no longer saves `Liked` | main bookmark button changed | `BOOKMARK_SELECTOR` in `utils/pixiv/facade.ts` |
| Bookmark in carousels does nothing / saves the wrong work | card bookmark wrapper or card structure changed | `CARD_BOOKMARK_SELECTOR`, `findCardWorkId` in `utils/pixiv/facade.ts` |
| Removing a carousel bookmark saves `Liked` instead of `Disliked` | bookmarked heart color changed | `BOOKMARKED_COLOR`, `isBookmarked` in `utils/pixiv/facade.ts` |
| Follow does not save the artist / saves the wrong status | Follow button attributes changed | `FOLLOW_SELECTOR`, `data-gtm-user-id`, `data-variant` in `facade.ts` and `cards.ts` |
| No Later buttons on thumbnails | thumbnail link or lazy image markup changed | `WORK_LINK_SELECTOR`, `img, figure` check in `utils/pixiv/cards.ts` |
| Later button in the wrong place on thumbnails | thumbnail wrapper changed | `link.parentElement` as the card in `injectWorkButtons` |
| No Later buttons on artist cards, or misplaced | Follow button or its row changed | `FOLLOW_SELECTOR`, `followButton.parentElement` in `injectArtistButtons` |
| Later button shows another work's / author's status after navigation | Pixiv reuses DOM differently (new attribute carries the id) | `attributeFilter` in `observeRecommendations`, `DONE_ATTR` rebinding in `cards.ts` |
| Later buttons on small icons, or missing on small thumbnails | thumbnail or icon sizes changed | `MIN_THUMB_SIZE` in `cards.ts` |
| Panel does not update after navigating between works | SPA navigation detection | `wxt:locationchange` in `entrypoints/pixiv.content.ts` |

## Internal API

Pixiv's own endpoints, called from the content script (same origin, the user's session cookies).
They are undocumented and can change without notice.

| Endpoint | Used in | Fields we read |
|---|---|---|
| `GET /ajax/illust/{id}` | `fetchWork` | `error`, `message`, `body.illustId`, `illustTitle`, `userId`, `userName`, `userAccount`, `urls.small`, `urls.thumb` |
| `GET /ajax/user/{id}?full=0` | `fetchArtist` | `error`, `message`, `body.userId`, `name`, `pixivId` (handle), `imageBig` (170px avatar) |

- Both expect the shape `{ error, message, body }` and throw if `error` is true or the HTTP status is not 2xx.
- If `/ajax/user` fails, `fetchWork` silently falls back to the illust fields (no avatar). A broken `/ajax/user`
  therefore shows up as "artists saved without avatar", not as an error.
- Canonical URLs are built by us, not read from Pixiv: `https://www.pixiv.net/artworks/{id}`,
  `https://www.pixiv.net/users/{id}`.

## URLs

| What | Pattern | Used in |
|---|---|---|
| Artwork page | `/artworks/{id}` or `/en/artworks/{id}` | `getArtworkId` (`api.ts`), regex `^/(?:en/)?artworks/(\d+)` |
| Content script scope | `*://www.pixiv.net/*` | `matches` in `pixiv.content.ts` |

A new locale prefix (e.g. `/ja/artworks/`) would make `getArtworkId` return `null`: no panel, and thumbnails
with such links get no Later button.

## DOM selectors

Pixiv's class names are generated (`sc-d9289f76-0`, `ebkyxS`) and change on every Pixiv deploy, so we never use them.
We rely on analytics attributes (`gtm-*`, `data-click-label`, `data-ga4-label`, `data-gtm-*`), which are more stable
but still not guaranteed.

| Constant / code | Value | File | Purpose | Assumption |
|---|---|---|---|---|
| `BOOKMARK_SELECTOR` | `button.gtm-main-bookmark` | `facade.ts` | bookmark of the open artwork | exists only while not bookmarked; after bookmarking it becomes an `<a href="/bookmark_add.php…">` |
| `CARD_BOOKMARK_SELECTOR` | `[data-ga4-label="bookmark_button"] button` | `facade.ts` | bookmark on carousel cards | same button for both states |
| `BOOKMARKED_COLOR` | `rgb(255, 64, 96)` (`#ff4060`) | `facade.ts` | detect a filled heart | computed `color` of the heart's `<svg>` |
| `findCardWorkId` | nearest `a[href*="/artworks/"]` within 4 parent levels | `facade.ts` | work id for a carousel bookmark | the thumbnail link is a close relative of the bookmark button |
| `FOLLOW_SELECTOR` | `button[data-click-label="follow"]` | `facade.ts`, `cards.ts` | Follow buttons everywhere | user id in `data-gtm-user-id`; `data-variant="Primary"` = not following, `"Default"` = following |
| `WORK_LINK_SELECTOR` | `a[href*="/artworks/"]` | `cards.ts` | work thumbnails | a thumbnail link contains `<img>` or a lazy `<figure>` placeholder; text links (titles) do not |
| card container | `link.parentElement` | `cards.ts` | where the work Later button goes | the link's parent is the square thumbnail box |
| artist row | `followButton.parentElement` | `cards.ts` | where the artist Later button goes, `data-ad-done` mark | the Follow button sits in a row next to avatar and name |
| `MIN_THUMB_SIZE` | `64` (px, link width) | `cards.ts` | skip event icons that link to an artwork | icons are 16–24px, thumbnails 80px+ |
| reused DOM | `attributeFilter: ['href', 'data-gtm-user-id']` | `cards.ts` | rebind a card when Pixiv swaps its data on SPA navigation | React keeps the element and changes only these attributes |

## Diagnosing a selector

In DevTools of a Pixiv page (Console), check whether a selector still matches:

```js
document.querySelectorAll('button[data-click-label="follow"]')
document.querySelectorAll('[data-ga4-label="bookmark_button"] button')
document.querySelector('button.gtm-main-bookmark')
getComputedStyle(document.querySelector('[data-ga4-label="bookmark_button"] svg')).color
```

- Empty result: the attribute was renamed or removed. Inspect the element (right click → Inspect) and look for
  another stable attribute: `aria-label`, `data-*`, `gtm-*`, `href`.
- Matches, but the wrong element: the structure changed (wrapper levels, parent element).
  Check `findCardWorkId` depth and `parentElement` assumptions.

For the internal API, open DevTools → Network on an artwork page, filter `ajax`, and compare the `illust/{id}` and
`user/{id}` responses with the fields in the table above.

## When fixing

- Keep selectors as constants at the top of the file, next to the `// Pixiv DOM` comment.
- Prefer attributes that describe meaning (`data-click-label`, `aria-*`, `href`) over structure (`parentElement`,
  depth limits) and over styles (colors).
- Update this file and the Facade / Cards sections of [extension.md](extension.md).
