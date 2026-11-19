import { THEME_TOKENS, mergeLabels, dispatch, toggleAttribute } from './shared.js';
import { TASKBAR_LABELS } from './labels.js';
import { PopupMenu, MENU_STYLES } from './menu.js';
import { RovingFocus } from './roving-focus.js';
import { taskButtonAction, windowMenuItems, windowMenuRequest, normalizeWindows, formatClock } from './taskbar-state.js';

const CLOCK_INTERVAL_MS = 10000;

const TOOLS = [
    { action: 'sort-grid', icon: 'eo_sort_grid', label: 'sortGrid' },
    { action: 'sort-vertical', icon: 'eo_sort_vertical', label: 'sortVertical' },
    { action: 'sort-horizontal', icon: 'eo_sort_horizontal', label: 'sortHorizontal' },
    { separator: true },
    { action: 'toggle-measures', icon: 'eo_toggle_measures', label: 'showMeasures', pressedBy: 'measures-visible' },
    { action: 'toggle-annotations', icon: 'eo_toggle_annotations', label: 'showAnnotations', pressedBy: 'annotations-visible' },
    { action: 'concordance-navigator', icon: 'eo_concordance_navigator', label: 'concordanceNav', pressedBy: 'concordance-navigator-open' }
];

const END_TOOLS = [
    { action: 'about', icon: 'eo_about', label: 'about' },
    { action: 'help', icon: 'eo_help', label: 'help' },
    { action: 'language-switch', icon: 'eo_language_switch', label: 'languageSwitch', shownBy: 'show-language-switch' }
];

function toolMarkup(tools) {
    return tools.map((tool) => tool.separator
        ? '<span class="separator" aria-hidden="true"></span>'
        : `<button type="button" class="tool" part="tool" data-action="${tool.action}"${tool.pressedBy ? ' aria-pressed="false"' : ''}><edirom-icon name="${tool.icon}" aria-hidden="true"></edirom-icon></button>`
    ).join('');
}

const template = document.createElement('template');
template.innerHTML = `
<style>
    :host {${THEME_TOKENS}
        display: block;
        font: var(--_ed-font);
        color: var(--_ed-primary);
    }

    :host([hidden]) {
        display: none;
    }

    .bar {
        display: flex;
        align-items: center;
        gap: 4px;
        box-sizing: border-box;
        height: var(--edirom-taskbar-height, 42px);
        padding: 5px;
        background: linear-gradient(
            color-mix(in srgb, var(--_ed-bar-background) 90%, white),
            var(--_ed-bar-background) 50%,
            color-mix(in srgb, var(--_ed-bar-background) 92%, black)
        );
        box-shadow: 0 0 1px #000000;
    }

    .tools {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 2px;
    }

    .tool {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        line-height: 0;
        cursor: pointer;
        appearance: none;
    }

    .tool[hidden] {
        display: none;
    }

    .tool[aria-pressed="true"] {
        background-color: color-mix(in oklch, var(--_ed-secondary) 88%, black);
        box-shadow: 0 1px 1px rgba(8, 8, 8, 0.5) inset;
    }

    .tool:hover {
        background-color: color-mix(in oklch, var(--_ed-secondary) 97%, black);
        box-shadow: 0 1px 1px rgba(8, 8, 8, 0.45) inset;
    }

    .tool:focus-visible {
        outline: 2px solid var(--_ed-primary);
        outline-offset: 1px;
    }

    .separator {
        flex: 0 0 auto;
        align-self: stretch;
        width: 1px;
        margin: 4px 6px;
        background: #8c8c8c;
    }

    .windows {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 5px;
        min-width: 0;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
    }

    .task {
        position: relative;
        display: flex;
        flex: 0 0 var(--edirom-taskbar-button-width, 140px);
        min-width: 0;
        align-items: center;
        gap: 4px;
        box-sizing: border-box;
        min-height: 26px;
        padding: 2px 10px 2px 6px;
        border: 0;
        border-radius: 3px;
        background: linear-gradient(#bdbdbd, #b3b3b3 50%, #a8a8a8);
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.4) inset;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }

    .task[aria-pressed="true"] {
        background: linear-gradient(#e3e3e3, #d9d9d9 50%, #cfcfcf);
        box-shadow: 0 1px 1px #000000 inset;
    }

    .task:focus-visible {
        outline: 2px solid var(--_ed-primary);
        outline-offset: 1px;
    }

    .task edirom-icon[hidden] {
        display: none;
    }

    .task-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .clock {
        flex: 0 0 auto;
        padding: 0 6px;
        color: var(--_ed-muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .clock[hidden] {
        display: none;
    }

    .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
    }

    ${MENU_STYLES}
</style>
<div class="bar" part="bar" role="region">
    <div class="tools" part="tools-start" role="toolbar">${toolMarkup(TOOLS)}</div>
    <span class="separator" aria-hidden="true"></span>
    <div class="windows" part="window-bar" role="toolbar"></div>
    <div class="tools" part="tools-end" role="toolbar">${toolMarkup(END_TOOLS)}</div>
    <time class="clock" part="clock" hidden></time>
</div>
`;

const SIMPLE_REQUESTS = {
    'sort-grid': ['sort-windows-request', { mode: 'grid' }],
    'sort-vertical': ['sort-windows-request', { mode: 'vertical' }],
    'sort-horizontal': ['sort-windows-request', { mode: 'horizontal' }],
    'concordance-navigator': ['concordance-navigator-toggle-request', null],
    'about': ['open-about-request', null],
    'help': ['open-help-request', null],
    'language-switch': ['language-switch-request', null]
};

const GLOBAL_TOGGLES = {
    'toggle-measures': ['measures-visible', 'toggle-measures-global'],
    'toggle-annotations': ['annotations-visible', 'toggle-annotations-global']
};

/**
 * Task bar of the Edirom desktop: window arrangement and global toggles on
 * the left, one button per window in the middle, about/help and an optional
 * clock on the right.
 *
 * The `windows` property takes the items of `WindowRegistry#getTaskbarItems()`.
 */
export class EdiromTaskbar extends HTMLElement {
    static observedAttributes = [
        'labels', 'lang', 'measures-visible', 'annotations-visible',
        'concordance-navigator-open', 'show-clock', 'show-language-switch'
    ];

    #labels = { ...TASKBAR_LABELS };
    #windows = [];
    #buttons = new Map();
    #elements;
    #windowMenu;
    #toolsStartFocus;
    #toolsEndFocus;
    #windowBarFocus;
    #clockTimer = null;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.append(template.content.cloneNode(true));

        this.#elements = {
            bar: shadow.querySelector('.bar'),
            toolsStart: shadow.querySelector('[part="tools-start"]'),
            toolsEnd: shadow.querySelector('[part="tools-end"]'),
            windowBar: shadow.querySelector('.windows'),
            clock: shadow.querySelector('.clock')
        };

        this.#windowMenu = new PopupMenu({
            onSelect: (action, anchor) => this.#onWindowMenuSelect(action, anchor.dataset.id)
        });
        shadow.append(this.#windowMenu.element);

        // One Tab stop per toolbar. Arrow keys move inside that toolbar.
        this.#toolsStartFocus = new RovingFocus(this.#elements.toolsStart, '.tool');
        this.#toolsEndFocus = new RovingFocus(this.#elements.toolsEnd, '.tool');
        this.#windowBarFocus = new RovingFocus(this.#elements.windowBar, '.task');

        shadow.querySelectorAll('.tool').forEach((tool) => {
            tool.addEventListener('click', () => this.#onToolClick(tool.dataset.action));
        });

        this.#elements.windowBar.addEventListener('click', this.#onTaskClick);
        this.#elements.windowBar.addEventListener('contextmenu', this.#onTaskContextMenu);
        this.#elements.windowBar.addEventListener('keydown', this.#onTaskKeyDown);
        // The scrollbar is hidden, so a plain mouse wheel has to scroll the window bar sideways.
        this.#elements.windowBar.addEventListener('wheel', this.#onWindowBarWheel, { passive: false });
    }

    connectedCallback() {
        this.#render();
        this.#updateClock();
    }

    disconnectedCallback() {
        this.#windowMenu.close();
        this.#stopClock();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        if (name === 'labels') {
            this.#labels = mergeLabels(TASKBAR_LABELS, newValue);
        }
        if (name === 'show-clock' || name === 'lang') {
            this.#updateClock();
        }
        this.#render();
    }

    get windows() {
        return this.#windows.map((w) => ({ ...w }));
    }

    set windows(value) {
        this.#windows = normalizeWindows(value);
        if (this.#windowMenu.isOpen && !this.#windows.some((w) => w.id === this.#windowMenu.anchor?.dataset.id)) {
            this.#windowMenu.close();
        }
        this.#renderWindows();
    }

    get labels() {
        return { ...this.#labels };
    }

    set labels(value) {
        this.setAttribute('labels', typeof value === 'string' ? value : JSON.stringify(value ?? {}));
    }

    get measuresVisible() { return this.hasAttribute('measures-visible'); }
    set measuresVisible(value) { toggleAttribute(this, 'measures-visible', value); }

    get annotationsVisible() { return this.hasAttribute('annotations-visible'); }
    set annotationsVisible(value) { toggleAttribute(this, 'annotations-visible', value); }

    get concordanceNavigatorOpen() { return this.hasAttribute('concordance-navigator-open'); }
    set concordanceNavigatorOpen(value) { toggleAttribute(this, 'concordance-navigator-open', value); }

    #onToolClick(action) {
        if (action in GLOBAL_TOGGLES) {
            const [attribute, type] = GLOBAL_TOGGLES[action];
            const visible = !this.hasAttribute(attribute);
            toggleAttribute(this, attribute, visible);
            dispatch(this, type, { visible });
            return;
        }

        const [type, detail] = SIMPLE_REQUESTS[action];
        dispatch(this, type, detail ? { ...detail } : null);
    }

    #findWindow(id) {
        return this.#windows.find((w) => w.id === id);
    }

    #onTaskClick = (event) => {
        const button = event.target.closest('.task');
        if (!button) return;

        const item = this.#findWindow(button.dataset.id);
        if (!item) return;

        const action = taskButtonAction(item);
        dispatch(this, action === 'minimize' ? 'window-minimize-request' : 'window-focus-request', { id: item.id });
    };

    #onTaskContextMenu = (event) => {
        const button = event.target.closest('.task');
        if (!button) return;

        event.preventDefault();
        this.#openWindowMenu(button);
    };

    #onTaskKeyDown = (event) => {
        const button = event.target.closest('.task');
        if (!button) return;

        if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
            event.preventDefault();
            this.#openWindowMenu(button);
        }
    };

    #onWindowBarWheel = (event) => {
        const windowBar = this.#elements.windowBar;
        if (event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        if (windowBar.scrollWidth <= windowBar.clientWidth) return;

        event.preventDefault();
        windowBar.scrollLeft += event.deltaY;
    };

    #openWindowMenu(button) {
        const item = this.#findWindow(button.dataset.id);
        if (!item) return;

        this.#windowMenu.setLabel(`${this.#labels.windowMenu}: ${item.title}`);
        this.#windowMenu.setItems(windowMenuItems(item, this.#labels));
        this.#windowMenu.open(button, { placement: 'above' });
    }

    #onWindowMenuSelect(action, id) {
        const [type, detail] = windowMenuRequest(action, id, this.#windows);
        dispatch(this, type, detail);
    }

    #render() {
        const labels = this.#labels;
        const focused = this.shadowRoot.activeElement;

        this.shadowRoot.querySelectorAll('.tool').forEach((tool) => {
            const config = [...TOOLS, ...END_TOOLS].find((t) => t.action === tool.dataset.action);
            const label = labels[config.label];
            tool.title = label;
            tool.setAttribute('aria-label', label);

            if (config.pressedBy) {
                tool.setAttribute('aria-pressed', String(this.hasAttribute(config.pressedBy)));
            }
            if (config.shownBy) {
                tool.hidden = !this.hasAttribute(config.shownBy);
            }
        });

        const { bar, toolsStart, toolsEnd, windowBar } = this.#elements;
        bar.setAttribute('aria-label', labels.taskbar);
        toolsStart.setAttribute('aria-label', labels.windowTools);
        toolsEnd.setAttribute('aria-label', labels.appTools);
        windowBar.setAttribute('aria-label', labels.windowBar);
        this.#toolsStartFocus.sync(null, focused);
        this.#toolsEndFocus.sync(null, focused);
        this.#renderWindows();
    }

    #renderWindows() {
        const windowBar = this.#elements.windowBar;
        const focused = this.shadowRoot.activeElement;
        const seen = new Set();

        this.#windows.forEach((item, index) => {
            seen.add(item.id);
            let button = this.#buttons.get(item.id);
            if (!button) {
                button = this.#createTaskButton(item.id);
                this.#buttons.set(item.id, button);
            }
            this.#updateTaskButton(button, item);

            if (windowBar.children[index] !== button) {
                windowBar.insertBefore(button, windowBar.children[index] ?? null);
            }
        });

        for (const [id, button] of this.#buttons) {
            if (!seen.has(id)) {
                button.remove();
                this.#buttons.delete(id);
            }
        }

        const active = this.#windows.find((w) => w.active);
        const activeButton = active ? this.#buttons.get(active.id) ?? null : null;
        // The active window is the tab stop. With none active, the first button is.
        // A focused button that was just removed gets focus back on that stop.
        this.#windowBarFocus.sync(activeButton ?? windowBar.querySelector('.task'), focused);
        if (activeButton) this.#revealTaskButton(activeButton);
    }

    #revealTaskButton(button) {
        const windowBar = this.#elements.windowBar;
        const start = button.offsetLeft - windowBar.offsetLeft;
        const end = start + button.offsetWidth;

        if (start < windowBar.scrollLeft) windowBar.scrollLeft = start;
        else if (end > windowBar.scrollLeft + windowBar.clientWidth) windowBar.scrollLeft = end - windowBar.clientWidth;
    }

    #createTaskButton(id) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'task';
        button.part = 'task-button';
        button.dataset.id = id;
        button.setAttribute('aria-keyshortcuts', 'Shift+F10');

        const icon = document.createElement('edirom-icon');
        icon.setAttribute('size', '16');
        icon.setAttribute('aria-hidden', 'true');

        const title = document.createElement('span');
        title.className = 'task-title';

        const state = document.createElement('span');
        state.className = 'task-state visually-hidden';

        button.append(icon, title, state);
        return button;
    }

    #updateTaskButton(button, item) {
        const [icon, title, state] = button.children;

        if (item.icon) {
            icon.setAttribute('name', item.icon);
            icon.hidden = false;
        } else {
            icon.hidden = true;
        }
        title.textContent = item.title;
        const stateLabel = item.minimized ? this.#labels.stateMinimized : item.hidden ? this.#labels.stateHidden : '';
        state.textContent = stateLabel ? `, ${stateLabel}` : '';
        button.title = item.title;
        button.setAttribute('aria-pressed', String(item.active));
        button.dataset.state = item.minimized ? 'minimized' : item.hidden ? 'hidden' : 'shown';
    }

    #updateClock() {
        const clock = this.#elements.clock;
        this.#stopClock();

        if (!this.isConnected || !this.hasAttribute('show-clock')) {
            clock.hidden = true;
            return;
        }

        const tick = () => {
            const now = new Date();
            clock.dateTime = now.toISOString();
            clock.textContent = formatClock(now, this.closest('[lang]')?.lang);
        };
        tick();
        clock.hidden = false;
        this.#clockTimer = setInterval(tick, CLOCK_INTERVAL_MS);
    }

    #stopClock() {
        if (this.#clockTimer !== null) {
            clearInterval(this.#clockTimer);
            this.#clockTimer = null;
        }
    }
}

if (!customElements.get('edirom-taskbar')) {
    customElements.define('edirom-taskbar', EdiromTaskbar);
}
