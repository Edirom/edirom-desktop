const supportsPopover = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;

export const MENU_STYLES = `
    .menu {
        position: fixed;
        inset: auto;
        margin: 0;
        display: none;
        box-sizing: border-box;
        min-width: 160px;
        max-height: min(500px, 100vh);
        overflow-y: auto;
        padding: 4px 0;
        background: #ffffff;
        color: #000000;
        border: 1px solid #999999;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        font: var(--_ed-font);
        z-index: 100000;
    }

    .menu.open {
        display: block;
    }

    .menu-item {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        box-sizing: border-box;
        padding: 4px 16px 4px 8px;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        white-space: nowrap;
        cursor: pointer;
    }

    .menu-item:hover:not([aria-disabled="true"]),
    .menu-item:focus-visible {
        background: var(--_ed-secondary);
        outline: none;
    }

    .menu-item[aria-disabled="true"] {
        color: #999999;
        cursor: default;
    }

    .menu-check {
        flex: 0 0 auto;
        width: 1em;
        visibility: hidden;
    }

    .menu-item[aria-checked="true"] .menu-check {
        visibility: visible;
    }

    .menu-separator {
        height: 1px;
        margin: 4px 0;
        background: #dddddd;
    }

    .menu-item.menu-empty {
        padding: 4px 12px;
        color: var(--_ed-muted);
    }
`;

/**
 * A light-dismiss popup menu rendered inside a shadow root.
 *
 * Items: `{ id, label, disabled, checked }` or `{ separator: true }`. With
 * `checkable` the items are radio items and show a check mark.
 */
export class PopupMenu {
    #anchor = null;
    #items = [];
    #placement = 'below';

    constructor({ label = '', checkable = false, emptyLabel = '', onSelect = () => {}, onToggle = () => {} } = {}) {
        this.checkable = checkable;
        this.emptyLabel = emptyLabel;
        this.onSelect = onSelect;
        this.onToggle = onToggle;

        this.element = document.createElement('div');
        this.element.className = 'menu';
        this.element.part = 'menu';
        this.element.setAttribute('role', 'menu');
        this.element.tabIndex = -1;
        if (supportsPopover) this.element.popover = 'manual';
        this.setLabel(label);

        this.element.addEventListener('click', this.#onClick);
        this.element.addEventListener('keydown', this.#onKeyDown);
    }

    get isOpen() {
        return this.element.classList.contains('open');
    }

    get anchor() {
        return this.#anchor;
    }

    setLabel(label) {
        this.element.setAttribute('aria-label', label);
    }

    setItems(items) {
        this.#items = items;
        this.element.replaceChildren(...this.#renderItems());
        if (this.isOpen) this.#position();
    }

    open(anchor, { placement = 'below' } = {}) {
        if (this.isOpen) this.close();

        this.#anchor = anchor;
        this.#placement = placement;
        this.element.classList.add('open');
        if (supportsPopover) this.element.showPopover();
        this.#position();

        document.addEventListener('pointerdown', this.#onOutsidePointer, true);
        window.addEventListener('resize', this.#onViewportChange);
        window.addEventListener('blur', this.#onViewportChange);

        (this.#enabledButtons().find((b) => b.getAttribute('aria-checked') === 'true')
            ?? this.#enabledButtons()[0]
            ?? this.#buttons()[0]
            ?? this.element).focus();

        this.onToggle(true, anchor);
    }

    close({ restoreFocus = false } = {}) {
        if (!this.isOpen) return;

        const anchor = this.#anchor;
        this.element.classList.remove('open');
        if (supportsPopover && this.element.matches(':popover-open')) this.element.hidePopover();

        document.removeEventListener('pointerdown', this.#onOutsidePointer, true);
        window.removeEventListener('resize', this.#onViewportChange);
        window.removeEventListener('blur', this.#onViewportChange);

        this.#anchor = null;
        if (restoreFocus && anchor && anchor.isConnected) anchor.focus();
        this.onToggle(false, anchor);
    }

    toggle(anchor, options) {
        if (this.isOpen && this.#anchor === anchor) this.close({ restoreFocus: true });
        else this.open(anchor, options);
    }

    #renderItems() {
        if (this.#items.length === 0 && this.emptyLabel) {
            const empty = document.createElement('div');
            empty.className = 'menu-item menu-empty';
            empty.part = 'menu-item';
            empty.tabIndex = -1;
            empty.setAttribute('role', 'menuitem');
            empty.setAttribute('aria-disabled', 'true');
            empty.textContent = this.emptyLabel;
            return [empty];
        }

        return this.#items.map((item) => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'menu-separator';
                separator.setAttribute('role', 'separator');
                return separator;
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'menu-item';
            button.part = 'menu-item';
            button.tabIndex = -1;
            button.dataset.id = item.id;
            if (item.disabled) button.setAttribute('aria-disabled', 'true');

            if (this.checkable) {
                button.setAttribute('role', 'menuitemradio');
                button.setAttribute('aria-checked', String(Boolean(item.checked)));
                const check = document.createElement('span');
                check.className = 'menu-check';
                check.setAttribute('aria-hidden', 'true');
                check.textContent = '\u2713';
                button.append(check);
            } else {
                button.setAttribute('role', 'menuitem');
            }

            const label = document.createElement('span');
            label.textContent = item.label;
            button.append(label);
            return button;
        });
    }

    #buttons() {
        return [...this.element.querySelectorAll('.menu-item')];
    }

    #enabledButtons() {
        return this.#buttons().filter((b) => b.getAttribute('aria-disabled') !== 'true');
    }

    #position() {
        if (!this.#anchor) return;

        const anchorRect = this.#anchor.getBoundingClientRect();
        const menuRect = this.element.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;

        const above = anchorRect.top - menuRect.height;
        const below = anchorRect.bottom;
        let top = this.#placement === 'above' ? above : below;
        if (this.#placement === 'above' && top < 0) top = below;
        if (this.#placement === 'below' && top + menuRect.height > viewportHeight && above >= 0) top = above;

        const left = Math.min(Math.max(0, anchorRect.left), Math.max(0, viewportWidth - menuRect.width));

        this.element.style.left = `${left}px`;
        this.element.style.top = `${Math.max(0, top)}px`;
    }

    #onClick = (event) => {
        const button = event.target.closest('.menu-item');
        if (!button || button.getAttribute('aria-disabled') === 'true') return;

        const anchor = this.#anchor;
        this.close({ restoreFocus: true });
        this.onSelect(button.dataset.id, anchor);
    };

    #onKeyDown = (event) => {
        const buttons = this.#buttons();
        const current = buttons.indexOf(this.element.getRootNode().activeElement);

        switch (event.key) {
            case 'ArrowDown':
                buttons[(current + 1) % buttons.length]?.focus();
                break;
            case 'ArrowUp':
                buttons[(current - 1 + buttons.length) % buttons.length]?.focus();
                break;
            case 'Home':
                buttons[0]?.focus();
                break;
            case 'End':
                buttons[buttons.length - 1]?.focus();
                break;
            case 'Escape':
                this.close({ restoreFocus: true });
                break;
            case 'Tab':
                this.close({ restoreFocus: true });
                break;
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
    };

    #onOutsidePointer = (event) => {
        const path = event.composedPath();
        if (path.includes(this.element) || path.includes(this.#anchor)) return;
        this.close();
    };

    #onViewportChange = () => {
        this.close();
    };
}
