# RetroShare WebUI design system

Use this guide for UI changes. The implementation is the source of truth:

- Tokens: `webui-src/app/scss/abstracts/_tokens.scss`.
- Breakpoints and mixins: `webui-src/app/scss/abstracts/`.
- Shared controls: `webui-src/app/widgets.js` and
  `webui-src/app/scss/components/`.
- Overlays: `webui-src/app/dialog.js` and `webui-src/app/popover.js`.

Edit source files, then rebuild. Do not edit generated CSS or icon assets.

## Direction

- Quiet, compact utility UI. Clear hierarchy, not decorative cards everywhere.
- Keep RetroShare's blue, small corners, fine borders and restrained chrome.
- One primary action per task. Neutral secondary actions; outlined destructive
  actions. Selection is a blue-tinted surface, not another primary button.
- Use the existing typography, spacing, weight and radius scales. Add a named
  token for a new reusable measurement or color; do not bypass the scale.

## Color reference

These are the current values from `_tokens.scss`, not a separate proposed
palette. Use `var(--token)` in code; the values here are for reference. Dark
inherits light values unless the dark palette overrides them.

### Surfaces, borders and text

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--ground` | `#fafafa` | `#161b21` | App background |
| `--surface` | `#ffffff` | `#1e252d` | Content panels, menus, dialogs |
| `--sunken` | `#f0f2f3` | `#192027` | Recessed fields and hover surfaces |
| `--line` | `#c9cdd0` | `#485563` | Control borders and structural rules |
| `--line-soft` | `#e8e8e8` | `#343f4b` | Quiet row separators |
| `--line-hover` | `#a8b0b6` | `#728394` | Hovered control borders |
| `--line-strong` | `#9aa3a9` | `#8092a3` | Dialog borders |
| `--press` | `#e9ecee` | `#354351` | Pressed controls |
| `--ink` | `#19232d` | `#edf2f7` | Headings and primary text |
| `--ink-body` | `#3d4a55` | `#d1dce5` | Body text |
| `--ink-dim` | `#566b7a` | `#a7b8c7` | Secondary text and metadata |
| `--ink-faint` | `#5a6e7b` | `#95a7b7` | Placeholders and quiet labels |

### Brand, actions and selection

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--brand` | `#0b7cb2` | `#6dc9f5` | Readable brand blue |
| `--brand-deep` | `#0a6899` | `#9bdcff` | Selected-label ink; not a primary-button fill |
| `--brand-pale` | `#abe3ff` | `#354f63` | Brand gradient tone |
| `--brand-hover` | `#1a9ad6` | `#87d5fa` | Brand hover tone |
| `--brand-press` | `#0b7cb2` | `#b4e6ff` | Brand pressed tone |
| `--accent` | `#0099cc` | `#6dc9f5` | Accent and active controls |
| `--action-top` | `#0b7cb2` | `#12618c` | Primary gradient start |
| `--action-bottom` | `#0a6899` | `#0b4f76` | Primary gradient end and hover fill |
| `--action-border` | `--action-bottom` | `--action-top` | Quiet primary border |
| `--on-brand` | `#ffffff` | `#ffffff` | Text/icons on filled actions |
| `--select` | `#a9d7ed` | `#254d67` | Selected rows |
| `--select-soft` | `#c9e5f4` | `#234054` | Soft selection and menu choices |
| `--select-edge` | `--brand` | `#6dc9f5` | Selection edge and focus outline |
| `--select-faint` | `#e4f1fa` | `#203544` | Quiet selected surfaces |

Primary buttons use a 180° gradient from `--action-top` to `--action-bottom`,
with `--action-border` and `--on-brand`. Hover eases the backing color toward
`--action-top`, without removing the gradient and flashing a clear background.
Do not substitute `--brand-deep` for
their border: its dark-theme value is intentionally light for text.

### Status and reach

Use status ink for readable labels, background/border tokens for status
surfaces, and the base status color for marks or fills. Always include a label
or icon; color alone must not carry state.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--up` | `#32cd32` | `#32cd32` | Good/active status marks |
| `--up-ink` | `#217a21` | `#8cd68c` | Good-status text |
| `--up-bg` | `#eff8ef` | `#203a2a` | Good-status background |
| `--up-line` | `#8cc98c` | `#547d5e` | Good-status border |
| `--down` | `#cd3232` | `#cd3232` | Failure/danger marks |
| `--down-ink` | `#c23636` | `#ffaaaa` | Error/destructive text |
| `--down-bg` | `#fbefef` | `#432b31` | Error/destructive background |
| `--down-line` | `#d79a9a` | `#a2656f` | Error/destructive border |
| `--warn` | `#dcdc41` | `#dcdc41` | Warning marks |
| `--warn-ink` | `#8a6d1f` | `#ead38d` | Warning text |
| `--warn-bg` | `#fdf8e3` | `#3b3523` | Warning background |
| `--warn-line` | `#d8cf8a` | `#978449` | Warning border |
| `--star` | `#e0a92b` | `#e0a92b` | Starred items, not warnings |
| `--reach-0` | `#0e8ecb` | `#6dc9f5` | Direct reach mark |
| `--reach-1` | `#57b6e3` | `#57b6e3` | One-hop reach mark |
| `--reach-1-ink` | `#2f7d9b` | `#89cce6` | One-hop text |
| `--reach-2` | `#9fcbff` | `#9fcbff` | Two-or-more-hop mark |
| `--reach-2-ink` | `#5d7486` | `#b0c8db` | Two-or-more-hop text |
| `--reach-off` | `#acb1b6` | `#acb1b6` | Offline/unknown reach mark |

Reach describes distance, not speed or health. These tokens do not imply that
every screen has hop data; use them only when that information is available.

### Gradients, overlays and elevation

| Token | Light | Dark |
| --- | --- | --- |
| `--chrome` | 180°: `#ffffff` → `#f4f6f7` | 180°: `#29333e` → `#222b35` |
| `--login-backdrop` | 135°: `--brand-deep` → `--brand-pale` | 135°: `--ground` → `--surface` |
| `--overlay` | `rgb(15 23 42 / 0.45)` | Same |
| `--overlay-strong` | `rgb(15 23 42 / 0.75)` | Same |
| `--media-ground` | `#101820` | Same |
| `--media-overlay` | `rgb(0 0 0 / 0.85)` | Same |
| `--media-control` | `rgb(0 0 0 / 0.25)` | Same |
| `--on-media` | `#ffffff` | Same |
| `--lift` | `0 12px 32px rgb(25 35 45 / 0.18)` | `0 12px 32px rgb(0 0 0 / 0.45)` |
| `--lift-sm` | `0 4px 12px rgb(25 35 45 / 0.12)` | `0 4px 12px rgb(0 0 0 / 0.35)` |
| `--ring` | `0 0 0 3px rgb(11 124 178 / 0.22)` | `0 0 0 3px rgb(109 201 245 / 0.22)` |

`--lift` lifts dialogs; `--lift-sm` lifts menus/tooltips. Ordinary chrome uses
fine borders and gradients rather than card shadows. Media stays dark in both
themes. Alpha variants use the matching `--ink-rgb`, `--ground-rgb`,
`--brand-rgb`, `--select-rgb`, `--down-rgb`, `--warn-rgb` or `--overlay-rgb`
channels. `--select-chevron` supplies a theme-specific SVG for select controls.

## Scales and assets

- Typography: `--t-title` (30), `--t-h2` (21), `--t-h3` (16), `--t-body` (15),
  `--t-row` (14), `--t-meta` (13), `--t-label` (12), `--t-micro` (11). Use micro
  text only for counts, tags and status pills, not names or sentences.
- Fonts: `--font-sans` (Archivo) for the interface; `--font-mono` (DM Mono)
  for IDs, hashes and changing numbers. Use tabular numerals for live readings.
- Weights: `--w-body` (400), `--w-label` (500), `--w-state` (600).
- Spacing: `--s1` through `--s6` (4, 8, 12, 16, 24, 32). Prefer parent gaps.
- Corners: `--r-sm` (2) for controls, `--r-md` (4) for sheets, `--r-full` (999)
  for pills.
- Controls: `--control` (30) and bare icon buttons `--glyph` (26), on desktop
  and mobile. `--touch` is for navigation and gesture areas, not all buttons.
- Icons: use `icon()` with names from `webui-src/make-src/icons.js`. It builds
  the Phosphor sprite. Label icon-only controls; decorative icons stay hidden
  from assistive technology.
- Branding: `brand_logo.js` embeds the existing RetroShare SVG in the app bundle.
  Home, login and navigation reuse that source without another image request.
  Images declare their intrinsic ratio; `--home-logo-size` and its mobile token
  reserve the homepage mark's space before decoding, preventing layout shifts.

Measurements above are in CSS pixels. Use token names in styles, not literals.

## Shared components

### Motion

- `--motion-fast` (120ms) for feedback; `--motion-enter` (280ms) for arrivals.
- `--motion-exit` (160ms) for exits; `--motion-layout` (320ms) for rails and sheets.
- `--motion-loop` (1200ms) for loading; `--motion-stagger` (32ms) for short lists.
- Use `--ease-out`, `--ease-in` and `--ease-layout`, with spacing-based travel.
- `motion.exit` keeps removed overlays mounted until their exit finishes.
  Loading loops do not delay removal. Reduced motion skips the wait and travel.
- `Loading` provides a shared, labeled status ring. Keep real request state as
  the source of truth; do not fake progress.
- `Segmented` shares one moving active tile/underline. Measurements follow
  selected button widths, badges and container resizing; reduced motion is instant.
- File branches expand/collapse their actual height. Directory rows are keyboard
  buttons, show pending work, and ignore duplicate loads.
- Forum replies reuse the same animated table shell and keep their columns aligned.
- Skeleton rows follow real group-list loading state. Cached rows stay visible
  during background refreshes; failed initial loads offer a retry.
- Pressed segmented buttons stay clear while the shared active tile moves.
  Keep keyboard focus visible, without a second mouse-focus fill.

- `PageHead`: title, optional back arrow, description and actions.
- `BackButton`: the same left arrow on every detail page.
- `SearchField`: persistent accessible name, optional clear or submit action.
- `select()` in `select.js`: styled combobox/listbox using the shared popover.
  Supports arrows, Home/End, typing, Enter, Escape and Tab. A hidden native select
  retains existing form values, labels, validation and change handlers.
- `Segmented`: labeled choices with a single tab stop and arrow/Home/End keys.
- `Menu`: compact secondary actions in a top-layer popover. Focus loss alone
  never dismisses it: touch browsers can blur before delivering a tap. Pass an
  accessible title, especially when the visible label disappears on phones.
- `Sidebar`: routed links or real buttons for local-state navigation.
- `ChatComposer`: shared attachments, emoji, message field and send action.
- `.group-table`: shared board/channel/forum lists, with icon, linked name,
  optional description, post count and last activity. Phone layouts hide counts.
- Desktop rail: `--nav-item-width` adds room beside the selection edge, with
  `--nav-item-size` height and `--s1` row gaps. Center `--nav-icon-size` glyphs;
  `--nav-gutter` keeps the icon column fixed on collapse.
- Expanded main navigation uses `--rail-open` (184), keeping the collapsed rail unchanged.
- Settings share a page header, section panels and aligned labels/fields.
  `--settings-width`, `--settings-label-width` and `--settings-field-width` keep
  forms readable on wide screens. Narrow screens stack fields; tables scroll.
- The network graph uses one high-DPI canvas, capped at 200 displayed peers.
  Spatial buckets limit repulsion work; springs run only while settling or dragging.
  Rendering does not redraw the app on every pointer move. Idle, hidden and
  removed graphs stop their frame loop; reduced motion disables settling.
- Graph view controls live inside the top-right corner; spacing is top-left,
  the legend bottom-left, and the interaction hint bottom-right. Drawing leaves
  room for these overlays. Nodes and labels stay within that usable rectangle.
- Peer names are visible by default, with cached text measurements and a Names
  toggle for crowded graphs. Clicking a node focuses it; Page Up/Down switches
  keyboard focus between peers, and arrow keys move the focused peer.
- Spacing scales spring and repulsion distances without refitting the camera,
  so changing it visibly changes density. Fit view remains an explicit action.
- The spacing slider retains native keyboard/touch behavior, with a thin filled
  track, outlined thumb, hover halo and numeric chip. Track fill follows its value;
  keyboard focus and forced-colors mode remain visible.
- Inline help icons follow their label text, with the same spacing and alignment.
- `popupMessage`: shared form/confirmation overlay; pass `title` and optional
  `lead`. Use `confirmMessage` for decisions and toasts for notices.
- `Dialog`: native modal shell, focus handling and visual-viewport sizing.
  Phone navigation sheets close when crossing into desktop layout. General
  popups pass `mobileOnly: false` so they remain available on desktop.
- `Popover`: anchored top-layer panel that follows scrolling and resizing.

Reuse these before introducing another component or page-specific control.

### Component locations and current consumers

Paths below are relative to `webui-src/app/`. Components share tokens but are
not all one generic row or modal; preserve the existing page-specific behavior.

| Component | Implementation | Used for |
| --- | --- | --- |
| `PageHead` / `BackButton` | `widgets.js`, `scss/components/_page-head.scss`, `_back-button.scss` | Files, group lists/details, Statistics headers and detail navigation |
| `SearchField` | `widgets.js`, `scss/components/_search.scss` | Network/People filters, Mail, Files search, group lists and forum threads |
| `Segmented` | `widgets.js`, `scss/components/_segmented.scss` | Network/People tabs, Mail filters, board view choices |
| `Menu` | `widgets.js`, `scss/components/_menu.scss` | People filter, board/channel/forum actions, mobile attachments |
| `Sidebar` | `widgets.js`, `scss/components/_navbar.scss` | Settings, Files and group section navigation; Statistics local selection |
| `Dialog` / `Popover` | `dialog.js`, `popover.js` | Modal focus/viewport shell and anchored menu panels |
| `popupMessage` / `confirmMessage` | `widgets.js`, `scss/layouts/_modal-container.scss` | Add Friend, Web Help, creation forms and confirmations |
| `ChatComposer` | `chat/chat_composer.js`, `scss/components/_chat-composer.scss` | Network direct chat, People chat, chat rooms |
| `EmojiPicker` | `chat/chat_emoji.js` | Shared composer emoji selection |
| `AppearanceControl` | `appearance_control.js`, `appearance.js` | Desktop status bar and mobile top strip |
| `CommentsSection` | `comments.js`, `scss/components/_comments.scss` | Board/channel post comments |
| `HistoryBrowserModal` | `people/people_history.js`, `scss/components/_history-browser.scss` | Network, People and room chat history |
| Group table | `scss/components/_group-table.scss` | Board/channel/forum lists rendered by their `*_util.js` modules |
| `TableLoading` / `ListError` | `widgets.js`, `scss/components/_group-table.scss` | Pending group lists and retryable loading failures |
| `TableBranch` | `table_branch.js`, `scss/components/_table-branch.scss` | Animated file folders and nested forum replies |
| `select()` | `select.js`, `scss/components/_select.scss` | Settings, identity choices and list filters |
| Settings shell | `config/config_resolver.js`, `scss/pages/_config.scss` | Shared headings and layouts for all settings sections |
| Network graph | `network/network_graph.js`, `network/graph_canvas.js`, `network/graph_physics.js`, `network/graph_viewport.js`, `scss/pages/_network-graph.scss` | Cached discovery, rectangular projection, bounded canvas rendering and on-demand springs |
| Media details | `scss/components/_media.scss` | Board/channel metadata and thumbnails |
| Post grid | `scss/components/_posts.scss` | Channel post cards |
| Transfer progress | `scss/components/_progress-bar.scss` | Files transfer percentages and chunk maps |
| Tooltips / identity cards | `scss/components/_tooltip.scss`, `people/people_util.js`, `mail/mail_identity_tooltip.js` | Settings help and identity details |
| Toasts | `toast.js`, `scss/components/_toast.scss` | Success, failure, warning and informational notices |

### Buttons, forms and content primitives

Shared primitive styles are in `scss/components/_ui.scss`; semantic button
roles are in `_buttons.scss`. Bare `<button>` elements already get the neutral
control style. Prefer explicit roles over page-specific color overrides.

| Element/class | Purpose |
| --- | --- |
| `button.is-primary`, `.b--primary`, `.b--strong` | Filled create/save/send action; submit buttons are primary by default |
| `button.is-danger`, `.b--danger` | Outlined destructive action |
| `.is-quiet`, `.b--quiet` | Low-emphasis action without a border |
| `button.is-icon`, `.b--icon` | Framed square icon button |
| `button.is-glyph`, `.b--glyph` | Bare square icon button, including dismiss |
| `button.is-sm`, `.b--sm` | Compact action inside a row or card |
| `button.is-close`, `.close-btn`, `.modal__close` | Shared dismiss-button treatment |
| `.form-field`, `.form-field--check` | Label/field grouping; checkbox label alongside the control |
| `.f`, `.f--mono`, `.fieldrow`, `.hint`, `.check` | Shared field, monospace variant, label grid, help and checkbox styles |
| `.row`, `.row__main`, `.row__title`, `.row__sub`, `.row__meta` | List-row primitive; selected states use a band/edge and readable ink |
| `.tabs`, `.tab` | CSS tab styling; use `Segmented` when keyboard selection behavior is needed |
| `.count`, `.tag`, `.tag--reach`, `.tag--up`, `.tag--down` | Counts and compact property/status labels |
| `.av`, `.av--lg` | Avatar surface styles; use existing `UserAvatar` for identity rendering |
| `.toolbar`, `.empty`, `.prose`, `.meterbar` | Toolbar, empty-state, reading-column and compact-meter primitives |
| `.sheet`, `.sheet--form`, `.sheet--wide` | Sheet surface styles, not a dialog/focus controller |

Some CSS primitives coexist with older page-specific markup. Do not assume a
class provides interaction behavior: CSS tabs and sheets still need accessible
controls and a component to manage their state.

### Usage examples

Mithril components use the existing module names:

```js
const m = require('mithril');
const widget = require('widgets');

m(widget.PageHead, {
  title: 'My files',
  actions: m('button.is-primary[type=button]', { onclick: addFile }, 'Add file'),
});

m(widget.SearchField, {
  label: 'Search files',
  value: query,
  oninput: (event) => { query = event.target.value; },
  onclear: () => { query = ''; },
});

m(widget.Menu, {
  title: 'Board actions',
  mark: 'ellipsis-v',
  items: [{ label: 'Subscribe', icon: 'bookmark', onclick: subscribe }],
});

widget.confirmMessage({
  title: 'Remove file?',
  message: 'This removes the selected file.',
  confirmLabel: 'Remove file',
  danger: true,
  onConfirm: removeFile,
});
```

The callbacks and `query` above belong to the calling component. For submitted
search, pass `onSubmit` to `SearchField`; otherwise filter using `oninput`.
Use `popupMessage(content, className, { title, lead })` for a form instead of
building another overlay. Set native `disabled` while an action is pending.

## Responsive behavior

- Phone navigation stays in the bottom bar; secondary destinations are in More.
  Keep six equal navigation slots. Mobile appearance switching sits in the top
  strip, just left of the friends-online indicator, not in the bottom bar.
- Section drawers open from a normal-flow section toolbar, not a floating button
  laid over page headings. The open drawer is a native modal dialog.
- Long names must not push toolbars or tables beyond their container.
- Collapse secondary columns before making the entire page scroll sideways.
  Wide data tables can scroll locally, with keyboard access.
- Buttons keep the desktop `--control` and `--glyph` heights on phones too.
  Keep input text large enough to avoid iOS focus zoom. Hidden button labels
  must retain an accessible name.
- Chat combines image/file actions behind one paperclip on phones. The message
  field gets the remaining width; Send is square and icon-only.
- Emoji pickers use the top layer when available and stay within the visual
  viewport, including when a mobile keyboard resizes it.
- Modals use native dialogs, an intrinsically sized scrolling body and the
  visual viewport. The title and dismiss remain outside the body scroller.

## Appearance

Settings → Appearance offers Device setting, Light and Dark. The preference is
saved as `rs.webui.appearance` in this browser. Device setting follows system
changes without a reload. The saved explicit theme is applied before CSS loads.
The rightmost icon in the desktop status bar opens the same three choices for
quick switching. On mobile, it sits in the top strip, left of friends online.

Use semantic roles rather than literal colors:

- `--ground`, `--surface`, `--sunken`: app, content and recessed surfaces.
- `--ink`, `--ink-body`, `--ink-dim`: primary, body and secondary text.
- `--select*`, `--brand-deep`: selected surfaces and their readable ink.
- `--action-top`, `--action-bottom`, `--action-border`, `--on-brand`: primary
  action fills, quiet border and text.
  Do not use `--surface` as a synonym for white text on a dark action.
- `--up-*`, `--down-*`, `--warn-*`: status ink, surfaces and borders.
- `--overlay*`, `--media-*`: dimming and media stages that stay dark in either
  theme. Native controls follow the root `color-scheme`.

Keep small text at WCAG AA contrast on its actual surface, including selected
and sunken states. Do not rely only on color to communicate a state.

## Group thumbnails

Board/channel logos are center-cropped to 64 × 64 PNG before publishing. Show
the processed preview, report failures, and block publishing while processing
or sending. Post media keeps its separate sizing behavior.

## Verification

From `webui-src/`:

```sh
npm run lint
npm run build
```

Check narrow phones, tablets and wide desktops in both appearances. Exercise
keyboard navigation, menus, search clearing, long names, empty states and
populated lists. Include:

- Modal actions remain reachable when content scrolls or the keyboard opens.
- Menu selections receive taps instead of activating rows behind the panel.
- Section drawers open, navigate and close after rotation.
- Composer photo/file actions and emoji pickers work without clipping.
- Appearance persists after reload and follows system changes in device mode.
- Desktop has a quick appearance control in the status bar; mobile has it next
  to friends online in the top strip, never in the bottom navigation.

For device-specific touch, keyboard or browser-chrome bugs, check a mobile
browser directly. Desktop device profiles help with layout but do not reproduce
every device behavior. An emulator is optional, not a required build step.

Browser fixtures validate presentation, not live Core behavior. Verify changed
flows against a running Core too.
