/**
 * What a click on a task button does: shown, inactive windows come to the
 * front, the active window is minimized, hidden or minimized windows are shown.
 */
export function taskButtonAction(item) {
    if (item.minimized || item.hidden) return 'focus';
    if (item.active) return 'minimize';
    return 'focus';
}

export const WINDOW_MENU_ACTIONS = Object.freeze(['restore', 'minimize', 'maximize', 'close', 'closeOther', 'closeAll']);

export function windowMenuItems(item, labels) {
    return [
        { id: 'restore', label: labels.restore, disabled: item.maximized !== true && item.hidden !== true },
        { id: 'minimize', label: labels.minimize, disabled: item.minimized === true },
        { id: 'maximize', label: labels.maximize, disabled: item.maximized === true || item.hidden === true },
        { separator: true },
        { id: 'close', label: labels.close },
        { separator: true },
        { id: 'closeOther', label: labels.closeOther },
        { id: 'closeAll', label: labels.closeAll }
    ];
}

/**
 * Event type and detail for a window menu action. Close requests carry the
 * scope so the desktop can include windows that have no task button.
 */
export function windowMenuRequest(action, id, items) {
    switch (action) {
        case 'restore': return ['window-restore-request', { id }];
        case 'minimize': return ['window-minimize-request', { id }];
        case 'maximize': return ['window-maximize-request', { id }];
        case 'close': return ['window-close-request', { scope: 'window', id, ids: [id] }];
        case 'closeOther': return ['window-close-request', { scope: 'others', id, ids: items.map((i) => i.id).filter((other) => other !== id) }];
        case 'closeAll': return ['window-close-request', { scope: 'all', id, ids: items.map((i) => i.id) }];
        default: throw new RangeError(`Unknown window menu action "${action}"`);
    }
}

export function normalizeWindows(windows) {
    if (!Array.isArray(windows)) return [];
    return windows
        .filter((w) => w && w.id !== undefined && w.id !== null)
        .map((w) => ({
            id: String(w.id),
            title: w.title ? String(w.title) : '',
            icon: w.icon || null,
            active: Boolean(w.active),
            hidden: Boolean(w.hidden),
            minimized: Boolean(w.minimized),
            maximized: Boolean(w.maximized)
        }));
}

export function formatClock(date, lang) {
    try {
        return new Intl.DateTimeFormat(lang || undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
    } catch {
        return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
    }
}
