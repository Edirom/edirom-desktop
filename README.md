# Edirom Desktop

Desktop shell for Edirom Online as web components: `<edirom-desktop>`, `<edirom-topbar>` and `<edirom-taskbar>`. It replaces the ExtJS desktop (`app/view/desktop/*`) of Edirom-Online-Frontend. Windows and the navigator are not part of this package; they are placed into slots and register with the desktop.

> **Status:** phase 2. Layout math, window registry, `<edirom-topbar>` and `<edirom-taskbar>` are done; the `<edirom-desktop>` shell follows.

## Usage

```html
<script type="module" src="path/to/edirom-core-web-components/src/edirom-icon.js"></script>
<script type="module" src="path/to/edirom-desktop/edirom-desktop.js"></script>

<edirom-topbar works='[{"id":"w1","title":"Der Freischütz"}]' active-work="w1">
  <edirom-connected-workspace slot="actions"></edirom-connected-workspace>
</edirom-topbar>
<edirom-taskbar show-clock></edirom-taskbar>
```

`<edirom-icon>` from [edirom-core-web-components](https://github.com/Edirom/edirom-core-web-components) must be loaded by the host page; this package does not import it.

All events are `CustomEvent`s with `bubbles` and `composed`, so they can be handled on any ancestor or on `document`. The elements never change application state themselves; they request it and expect the host to update their attributes and properties.

## Development

No dependencies; Node 20 or newer is enough.

```sh
npm test                          # unit tests
python3 -m http.server 8090       # then open http://localhost:8090/demo/
```

The demo loads `<edirom-icon>` from jsDelivr, pinned to the commit used by Edirom-Online-Frontend, and wires both bars to a `WindowRegistry` with fake windows. Every event is shown in a log panel.

## `<edirom-topbar>`

Home button, work switcher, search field and a slot for further actions.

| Attribute | Property | Description |
|---|---|---|
| `works` | `works` | JSON array `[{ "id", "title" }]`. The work switcher is hidden when empty. |
| `active-work` | `activeWork` | Id of the selected work. Updated when the user picks a work. |
| `labels` | `labels` | JSON object overriding the [top bar labels](#labels). |
| `logo` | | Image URL for the home button. Defaults to a home icon. |
| | `searchValue` | Current text of the search field. |

| Method | Description |
|---|---|
| `focusSearch()` | Moves focus to the search field. |

| Slot | Description |
|---|---|
| `actions` | Right end of the bar, e.g. `<edirom-connected-workspace>`. |
| `logo` | Custom content for the home button. |

| Event | Detail | When |
|---|---|---|
| `home-request` | `null` | The home button was clicked. |
| `work-select` | `{ workId, previousWorkId }` | The user picked a different work. `active-work` is already updated. |
| `search-request` | `{ term }` | Enter in the search field or click on the search icon. `term` is the raw field value and may be empty. |

## `<edirom-taskbar>`

Window arrangement and global toggles on the left, one button per window in the middle, about/help and an optional clock on the right.

| Attribute | Property | Description |
|---|---|---|
| `measures-visible` | `measuresVisible` | Pressed state of the measure numbers toggle. |
| `annotations-visible` | `annotationsVisible` | Pressed state of the annotations toggle. |
| `concordance-navigator-open` | `concordanceNavigatorOpen` | Pressed state of the concordance navigator button. Not changed by the bar itself. |
| `show-clock` | | Shows the clock, formatted for the nearest `lang`. |
| `show-language-switch` | | Shows the language switch button (hidden by default, as in Edirom Online today). |
| `labels` | `labels` | JSON object overriding the [task bar labels](#labels). |
| | `windows` | Task buttons, as returned by `WindowRegistry#getTaskbarItems()`: `[{ id, title, icon, active, hidden, minimized, maximized }]`. `icon` is an `<edirom-icon>` name. |

| Event | Detail | When |
|---|---|---|
| `sort-windows-request` | `{ mode }` with `grid`, `vertical` or `horizontal` | A sort button was clicked. `<edirom-desktop>` will add the target rects. |
| `toggle-measures-global` | `{ visible }` | The measure numbers toggle was clicked. The attribute is already updated. |
| `toggle-annotations-global` | `{ visible }` | The annotations toggle was clicked. The attribute is already updated. |
| `concordance-navigator-toggle-request` | `null` | The concordance navigator button was clicked. |
| `open-about-request`, `open-help-request` | `null` | About or help was clicked. |
| `language-switch-request` | `null` | The language switch was clicked. |
| `window-focus-request` | `{ id }` | Task button of a hidden, minimized or inactive window: show it and bring it to the front. |
| `window-minimize-request` | `{ id }` | Task button of the active window, or "Minimize" in the window menu. |
| `window-restore-request` | `{ id }` | "Restore" in the window menu. |
| `window-maximize-request` | `{ id }` | "Maximize" in the window menu. |
| `window-close-request` | `{ scope, id, ids }` | "Close", "Close other windows" or "Close all windows". `scope` is `window`, `others` or `all`; `ids` lists the affected task buttons. Windows without a task button are the host's decision. |

The window menu opens on right click, the context menu key or Shift+F10 on a task button. The arrow keys move between task buttons.

## Labels

English defaults; pass translations through the `labels` attribute or property. Unknown keys are ignored.

| Element | Keys |
|---|---|
| `<edirom-topbar>` | `home`, `homeLabel`, `workSwitch`, `noWorks`, `searchField`, `search` |
| `<edirom-taskbar>` | `sortGrid`, `sortVertical`, `sortHorizontal`, `showMeasures`, `showAnnotations`, `concordanceNav`, `windowBar`, `about`, `help`, `languageSwitch`, `windowMenu`, `restore`, `minimize`, `maximize`, `close`, `closeOther`, `closeAll` |

## Styling

| Custom property | Default | Description |
|---|---|---|
| `--primary-color` | `#000000` | Text and focus outlines. |
| `--secondary-color` | `#cacaca` | Hover background in menus (also used by `<edirom-icon>`). |
| `--edirom-desktop-bar-background` | `#cccccc` | Base color of both bars. |
| `--edirom-desktop-muted-color` | `#666666` | Home label, clock. |
| `--edirom-desktop-font` | `13px/1.3 helvetica, arial, verdana, sans-serif` | Font of both bars and menus. |
| `--edirom-topbar-height` | `41px` | |
| `--edirom-topbar-search-width` | `180px` | |
| `--edirom-taskbar-height` | `42px` | |
| `--edirom-taskbar-button-width` | `140px` | |

Parts: `bar`, `home-button`, `home-label`, `work-switch`, `search`, `search-field`, `search-button`, `actions`, `tools-start`, `tools-end`, `tool`, `window-bar`, `task-button`, `clock`, `menu`, `menu-item`.

## Layout (`src/layout.js`)

Pure functions. Rects are `{ x, y, width, height }` in pixels.

| Function | Description |
|---|---|
| `getUsableSize(surface, { navigatorWidth = 0, bottomMargin = 10 })` | Area available for windows. |
| `getSizeAndPosition(usableSize, occupied, { maxWidth, maxHeight })` | Default rect for a new window: two thirds of the usable width, cascaded 20/15 px away from each occupied top-left corner. Minimum 300 px before cascading. |
| `getLayout(mode, count, usableSize, origin)` | Tiling rects for `mode` = `"grid"`, `"vertical"` or `"horizontal"`. Each cell has a 3 px horizontal and 2 px vertical margin. |
| `gridLayout`, `verticalLayout`, `horizontalLayout` | The individual tiling modes. |
| `gridDimensions(count)` | `{ columns, rows }` of the grid. Prime counts are rounded up (3 windows give a 2x2 grid). |

The results are identical to the ExtJS implementation; `test/legacy-ext.js` keeps a reference copy for the parity tests.

## Window registry (`src/window-registry.js`)

`WindowRegistry` is the source of truth for the windows on the desktop. It is an `EventTarget`.

A window entry:

| Field | Type | Description |
|---|---|---|
| `id` | string | Required, unique. |
| `title` | string | Shown on the task button. |
| `icon` | string \| null | Icon name for the task button. |
| `special` | boolean | Help, about, search, concordance navigator: excluded from tiling. |
| `hiddenInTaskbar` | boolean | No task button. |
| `hidden`, `minimized`, `maximized` | boolean | Window state. |
| `rect` | rect \| null | Last known position and size. |

| Method | Description |
|---|---|
| `register(entry)` | Adds a window on top of the z-order. Throws on missing or duplicate ids. |
| `unregister(id)` | Removes a window. Returns `false` if unknown. |
| `update(id, patch)` | Changes title, icon, flags or rect. `rect` patches are merged; `null` clears it. |
| `setActive(id)` | Brings a window to the front and clears `hidden` and `minimized`. |
| `get(id)`, `has(id)`, `size` | Lookup. Entries are frozen snapshots. |
| `getActive()`, `getActiveId()` | The topmost window that is neither hidden nor minimized. |
| `isVisible(id)` | Shown, i.e. neither hidden nor minimized. |
| `getAll({ excludeSpecial, excludeMinimized })` | Windows in registration order. |
| `getZOrder()` | Windows from bottom to top. |
| `getTaskbarItems()` | `{ id, title, icon, active, hidden, minimized, maximized }` for every window with a task button. |
| `getOccupiedPositions()` | Top-left corners of shown windows. |
| `getSizeAndPosition(usableSize, limits)` | `getSizeAndPosition` with the registry's occupied positions. |
| `getSortRects(mode, usableSize, origin)` | Target rects keyed by id for all non-special, non-minimized windows. In grid mode, hidden and maximized windows count when sizing the grid but get no cell. |
| `clear()` | Removes all windows. |

| Event | Detail | When |
|---|---|---|
| `change` | `{ reason, id }` with `reason` = `register`, `unregister`, `update`, `activate` or `clear` | After every mutation. |
| `activechange` | `{ id, previousId }` | The active window changed. `id` is `null` when no window is shown. |

## License

GPL-3.0-or-later, see [LICENSE](LICENSE).
