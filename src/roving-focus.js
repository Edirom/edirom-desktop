/**
 * Next index for a horizontal roving tabindex.
 * ArrowLeft and ArrowRight wrap. Home and End jump to the ends.
 * Any other key returns `index`. `count` below 1 yields 0.
 */
export function nextIndex(key, index, count) {
    if (count < 1) return 0;
    switch (key) {
        case 'ArrowLeft': return (index - 1 + count) % count;
        case 'ArrowRight': return (index + 1) % count;
        case 'Home': return 0;
        case 'End': return count - 1;
        default: return index;
    }
}

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

/**
 * Roving tabindex for the buttons of one toolbar.
 *
 * Exactly one visible button has tabindex 0, so Tab visits the toolbar once.
 * ArrowLeft, ArrowRight, Home and End move that stop. Buttons with the
 * hidden attribute are skipped.
 */
export class RovingFocus {
    #container;
    #selector;
    #tabStop = null;
    /** Buttons this toolbar has shown, including ones removed since. */
    #known = new WeakSet();

    constructor(container, selector) {
        this.#container = container;
        this.#selector = selector;
        container.addEventListener('keydown', this.#onKeyDown);
        container.addEventListener('focusin', this.#onFocusIn);
    }

    /**
     * Keep a single tab stop.
     *
     * `preferred`, when it is a visible button here, becomes that stop.
     * Otherwise the focused button, the previous stop, or the first visible
     * button. When `focused` belonged to this toolbar and is now hidden or
     * removed, focus moves to the new stop.
     */
    sync(preferred = null, focused = null) {
        const buttons = this.#buttons();
        const visible = buttons.filter((button) => !button.hasAttribute('hidden'));
        const tabStop = visible.includes(preferred) ? preferred
            : visible.includes(focused) ? focused
            : visible.includes(this.#tabStop) ? this.#tabStop
            : visible[0] ?? null;

        this.#place(tabStop, buttons);

        const lost = focused && this.#known.has(focused) && !visible.includes(focused);
        if (lost && tabStop && focused !== tabStop) tabStop.focus();
    }

    #buttons() {
        const buttons = [...this.#container.querySelectorAll(this.#selector)];
        for (const button of buttons) this.#known.add(button);
        return buttons;
    }

    #place(tabStop, buttons) {
        for (const button of buttons) {
            button.tabIndex = button === tabStop ? 0 : -1;
        }
        this.#tabStop = tabStop;
    }

    #buttonFrom(target) {
        if (!target || typeof target.closest !== 'function') return null;
        const button = target.closest(this.#selector);
        if (!button || !this.#container.contains(button) || button.hasAttribute('hidden')) return null;
        return button;
    }

    #onFocusIn = (event) => {
        const button = this.#buttonFrom(event.target);
        if (!button) return;
        this.#known.add(button);
        this.#place(button, this.#buttons());
    };

    #onKeyDown = (event) => {
        if (!NAV_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;

        const button = this.#buttonFrom(event.target);
        if (!button) return;

        const buttons = this.#buttons();
        const visible = buttons.filter((item) => !item.hasAttribute('hidden'));
        const index = visible.indexOf(button);
        if (index === -1) return;

        event.preventDefault();
        const next = visible[nextIndex(event.key, index, visible.length)];
        this.#place(next, buttons);
        next.focus();
    };
}
