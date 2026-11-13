import { getLayout, getSizeAndPosition } from './layout.js';

const FLAGS = ['hidden', 'minimized', 'maximized'];
const DESCRIPTORS = ['title', 'icon', 'special', 'hiddenInTaskbar'];

function snapshot(entry) {
    return Object.freeze({ ...entry, rect: entry.rect ? Object.freeze({ ...entry.rect }) : null });
}

function isShown(entry) {
    return !entry.hidden && !entry.minimized;
}

/**
 * Source of truth for the windows on the desktop.
 *
 * Windows are kept in registration order (task bar, tiling) and in a separate
 * z-order. The active window is always the topmost shown window, so it never
 * has to be set explicitly when a window is hidden, minimized or removed.
 *
 * Fires `change` ({ reason, id }) after every mutation and `activechange`
 * ({ id, previousId }) whenever the active window changes.
 */
export class WindowRegistry extends EventTarget {
    #windows = new Map();
    #zOrder = [];
    #activeId = null;

    register({ id, title = '', icon = null, special = false, hiddenInTaskbar = false, hidden = false, minimized = false, maximized = false, rect = null }) {
        if (id === undefined || id === null || id === '') {
            throw new TypeError('registerWindow requires an id');
        }
        if (this.#windows.has(id)) {
            throw new Error(`Window "${id}" is already registered`);
        }

        this.#windows.set(id, {
            id,
            title,
            icon,
            special: Boolean(special),
            hiddenInTaskbar: Boolean(hiddenInTaskbar),
            hidden: Boolean(hidden),
            minimized: Boolean(minimized),
            maximized: Boolean(maximized),
            rect: rect ? { ...rect } : null
        });
        this.#zOrder.push(id);

        this.#commit('register', id);
        return this.get(id);
    }

    unregister(id) {
        if (!this.#windows.delete(id)) return false;

        this.#zOrder = this.#zOrder.filter((zId) => zId !== id);
        this.#commit('unregister', id);
        return true;
    }

    update(id, patch) {
        const entry = this.#require(id);

        for (const key of DESCRIPTORS) {
            if (key in patch) entry[key] = key === 'title' || key === 'icon' ? patch[key] : Boolean(patch[key]);
        }
        for (const key of FLAGS) {
            if (key in patch) entry[key] = Boolean(patch[key]);
        }
        if ('rect' in patch) {
            entry.rect = patch.rect ? { ...entry.rect, ...patch.rect } : null;
        }

        this.#commit('update', id);
        return this.get(id);
    }

    /**
     * Brings a window to the front. Activating implies showing, so `hidden`
     * and `minimized` are cleared.
     */
    setActive(id) {
        const entry = this.#require(id);

        entry.hidden = false;
        entry.minimized = false;
        this.#zOrder = this.#zOrder.filter((zId) => zId !== id);
        this.#zOrder.push(id);

        this.#commit('activate', id);
        return this.get(id);
    }

    has(id) {
        return this.#windows.has(id);
    }

    get(id) {
        const entry = this.#windows.get(id);
        return entry ? snapshot(entry) : null;
    }

    get size() {
        return this.#windows.size;
    }

    getActiveId() {
        return this.#activeId;
    }

    getActive() {
        return this.#activeId === null ? null : this.get(this.#activeId);
    }

    isVisible(id) {
        const entry = this.#windows.get(id);
        return Boolean(entry && isShown(entry));
    }

    /** Windows in registration order. */
    getAll({ excludeSpecial = false, excludeMinimized = false } = {}) {
        const result = [];
        for (const entry of this.#windows.values()) {
            if (excludeSpecial && entry.special) continue;
            if (excludeMinimized && entry.minimized) continue;
            result.push(snapshot(entry));
        }
        return result;
    }

    /** Windows from bottom to top. */
    getZOrder() {
        return this.#zOrder.map((id) => this.get(id));
    }

    getTaskbarItems() {
        return this.getAll()
            .filter((entry) => !entry.hiddenInTaskbar)
            .map((entry) => Object.freeze({
                id: entry.id,
                title: entry.title,
                icon: entry.icon,
                active: entry.id === this.#activeId,
                hidden: entry.hidden,
                minimized: entry.minimized,
                maximized: entry.maximized
            }));
    }

    /** Top-left corners of all shown windows that have a rect. */
    getOccupiedPositions() {
        const positions = [];
        for (const entry of this.#windows.values()) {
            if (isShown(entry) && entry.rect) {
                positions.push({ x: entry.rect.x, y: entry.rect.y });
            }
        }
        return positions;
    }

    getSizeAndPosition(usableSize, limits) {
        return getSizeAndPosition(usableSize, this.getOccupiedPositions(), limits);
    }

    /**
     * Target rects for the tiling modes, keyed by window id. Special and
     * minimized windows are left alone. In grid mode hidden and maximized
     * windows still count when sizing the grid but do not take a cell.
     */
    getSortRects(mode, usableSize, origin) {
        const candidates = this.getAll({ excludeSpecial: true, excludeMinimized: true });
        const rects = getLayout(mode, candidates.length, usableSize, origin);
        const placed = mode === 'grid'
            ? candidates.filter((entry) => !entry.hidden && !entry.maximized)
            : candidates;

        const result = {};
        placed.forEach((entry, i) => {
            result[entry.id] = rects[i];
        });
        return result;
    }

    clear() {
        this.#windows.clear();
        this.#zOrder = [];
        this.#commit('clear', null);
    }

    #require(id) {
        const entry = this.#windows.get(id);
        if (!entry) throw new Error(`Window "${id}" is not registered`);
        return entry;
    }

    #commit(reason, id) {
        const previousId = this.#activeId;
        this.#activeId = this.#computeActiveId();

        this.dispatchEvent(new CustomEvent('change', { detail: { reason, id } }));
        if (this.#activeId !== previousId) {
            this.dispatchEvent(new CustomEvent('activechange', { detail: { id: this.#activeId, previousId } }));
        }
    }

    #computeActiveId() {
        for (let i = this.#zOrder.length - 1; i >= 0; i--) {
            const entry = this.#windows.get(this.#zOrder[i]);
            if (isShown(entry)) return entry.id;
        }
        return null;
    }
}
