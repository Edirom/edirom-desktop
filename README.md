# Edirom Desktop

Desktop shell for Edirom Online as web components: `<edirom-desktop>`, `<edirom-topbar>` and `<edirom-taskbar>`. It replaces the ExtJS desktop (`app/view/desktop/*`) of Edirom-Online-Frontend. Windows and the navigator are not part of this package; they are placed into slots and register with the desktop.

> **Status:** phase 1. The layout math and the window registry are done; the custom elements follow.

## Development

No dependencies; Node 20 or newer is enough.

```sh
npm test
```

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
| `getTaskbarItems()` | `{ id, title, icon, active, hidden, minimized }` for every window with a task button. |
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
