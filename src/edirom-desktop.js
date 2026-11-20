import { THEME_TOKENS, parseJson, mergeLabels, dispatch, toggleAttribute } from './shared.js';
import { DESKTOP_LABELS } from './labels.js';
import { WindowRegistry } from './window-registry.js';
import { getUsableSize, getLayout } from './layout.js';
import { CONCORDANCE_NAVIGATOR_KIND, FORWARDED_ATTRIBUTES, isKindVisible, closeRequestIds, sameMetrics, cssUrl } from './desktop-state.js';
import './edirom-topbar.js';
import './edirom-taskbar.js';

const ORIGIN = Object.freeze({ x: 0, y: 0 });

const SORT_ANNOUNCEMENTS = Object.freeze({
    grid: 'arrangedGrid',
    vertical: 'arrangedVertical',
    horizontal: 'arrangedHorizontal'
});

const template = document.createElement('template');
template.innerHTML = `
<style>
    :host {${THEME_TOKENS}
        display: flex;
        flex-direction: column;
        position: relative;
        box-sizing: border-box;
        height: 100%;
        overflow: hidden;
        font: var(--_ed-font);
    }

    :host([hidden]) {
        display: none;
    }

    edirom-topbar,
    edirom-taskbar {
        flex: 0 0 auto;
    }

    .surface {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
        isolation: isolate;
        background: var(--edirom-desktop-background,
            radial-gradient(at 50% 70%, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0)),
            linear-gradient(#586e75, #839496));
    }

    .wallpaper {
        position: absolute;
        inset: 0;
        background-position: 0 0;
        background-repeat: repeat;
        pointer-events: none;
    }

    :host([wallpaper-stretch]) .wallpaper {
        background-size: 100% 100%;
        background-repeat: no-repeat;
    }

    .workspace {
        position: absolute;
        inset: 0;
    }

    ::slotted([slot="workspace"]) {
        position: absolute;
        inset: 0;
    }

    .navigator {
        position: absolute;
        top: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        max-height: 100%;
    }

    .navigator[hidden] {
        display: none;
    }

    ::slotted([slot="navigator"]) {
        flex: 0 1 auto;
        min-height: 0;
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
</style>
<edirom-topbar part="topbar"><slot name="topbar-actions" slot="actions"></slot></edirom-topbar>
<div class="surface" part="surface">
    <div class="wallpaper" part="wallpaper"></div>
    <div class="workspace" part="workspace" role="main"><slot name="workspace"></slot></div>
    <div class="navigator" part="navigator" hidden><slot name="navigator"></slot></div>
</div>
<edirom-taskbar part="taskbar"></edirom-taskbar>
<div class="visually-hidden" role="status" aria-live="polite"></div>
`;

/**
 * Desktop shell of Edirom Online: top bar, a surface with wallpaper, the
 * workspace for windows and the navigator column, and the task bar.
 *
 * The desktop keeps the window registry. Hosts register their windows and
 * report state changes; the desktop renders the task bar from it and answers
 * layout questions. Window content itself stays in light DOM (`workspace`
 * slot), so ExtJS windows keep their styles.
 */
export class EdiromDesktop extends HTMLElement {
    static observedAttributes = [
        'wallpaper',
        ...new Set([...FORWARDED_ATTRIBUTES.topbar, ...FORWARDED_ATTRIBUTES.taskbar])
    ];

    #registry = new WindowRegistry();
    #elements;
    #resizeObserver = null;
    #metrics = null;
    #announceToken = 0;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.append(template.content.cloneNode(true));
        // The bars must be upgraded before their properties are set, even while the host is disconnected.
        customElements.upgrade(shadow);

        this.#elements = {
            topbar: shadow.querySelector('edirom-topbar'),
            taskbar: shadow.querySelector('edirom-taskbar'),
            surface: shadow.querySelector('.surface'),
            wallpaper: shadow.querySelector('.wallpaper'),
            workspace: shadow.querySelector('.workspace'),
            navigator: shadow.querySelector('.navigator'),
            navigatorSlot: shadow.querySelector('slot[name="navigator"]'),
            status: shadow.querySelector('[role="status"]')
        };

        const { topbar, taskbar, navigator, navigatorSlot } = this.#elements;

        this.#registry.addEventListener('change', () => this.#syncWindows());
        this.#registry.addEventListener('activechange', (event) => {
            dispatch(this, 'active-window-change', { ...event.detail });
        });

        taskbar.addEventListener('sort-windows-request', this.#onSortRequest);
        taskbar.addEventListener('window-close-request', this.#onCloseRequest);
        taskbar.addEventListener('toggle-measures-global', (event) => {
            toggleAttribute(this, 'measures-visible', event.detail.visible);
        });
        taskbar.addEventListener('toggle-annotations-global', (event) => {
            toggleAttribute(this, 'annotations-visible', event.detail.visible);
        });
        topbar.addEventListener('work-select', (event) => {
            this.setAttribute('active-work', event.detail.workId);
        });
        navigatorSlot.addEventListener('slotchange', () => {
            navigator.hidden = navigatorSlot.assignedNodes().length === 0;
        });
    }

    connectedCallback() {
        this.#syncLabels();
        this.#syncLang();
        this.#syncWindows();

        if (typeof ResizeObserver !== 'undefined' && !this.#resizeObserver) {
            const { surface, navigator, topbar, taskbar } = this.#elements;
            this.#resizeObserver = new ResizeObserver(() => this.#updateMetrics());
            [surface, navigator, topbar, taskbar].forEach((element) => this.#resizeObserver.observe(element));
        }
    }

    disconnectedCallback() {
        this.#resizeObserver?.disconnect();
        this.#resizeObserver = null;
        this.#metrics = null;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        if (name === 'wallpaper') {
            this.#elements.wallpaper.style.backgroundImage = cssUrl(newValue);
            return;
        }
        if (name === 'lang') {
            this.#syncLang();
            return;
        }
        if (name === 'labels') this.#syncLabels();
        for (const [bar, names] of Object.entries(FORWARDED_ATTRIBUTES)) {
            if (names.includes(name)) forwardAttribute(this.#elements[bar], name, newValue);
        }
    }

    // Attributes and properties

    get wallpaper() { return this.getAttribute('wallpaper'); }
    set wallpaper(value) { setOrRemove(this, 'wallpaper', value); }

    get wallpaperStretch() { return this.hasAttribute('wallpaper-stretch'); }
    set wallpaperStretch(value) { toggleAttribute(this, 'wallpaper-stretch', value); }

    get labels() { return parseJson(this.getAttribute('labels'), {}); }
    set labels(value) { this.setAttribute('labels', typeof value === 'string' ? value : JSON.stringify(value ?? {})); }

    get works() { return this.#elements.topbar.works; }
    set works(value) { this.setAttribute('works', typeof value === 'string' ? value : JSON.stringify(value ?? [])); }

    get activeWork() { return this.getAttribute('active-work'); }
    set activeWork(value) { setOrRemove(this, 'active-work', value); }

    get measuresVisible() { return this.hasAttribute('measures-visible'); }
    set measuresVisible(value) { toggleAttribute(this, 'measures-visible', value); }

    get annotationsVisible() { return this.hasAttribute('annotations-visible'); }
    set annotationsVisible(value) { toggleAttribute(this, 'annotations-visible', value); }

    get showClock() { return this.hasAttribute('show-clock'); }
    set showClock(value) { toggleAttribute(this, 'show-clock', value); }

    /** True while a window of kind `concordance-navigator` is shown. */
    get concordanceNavigatorOpen() {
        return isKindVisible(this.#registry.getAll(), CONCORDANCE_NAVIGATOR_KIND);
    }

    // Window registry

    registerWindow(entry) { return this.#registry.register(entry); }
    unregisterWindow(id) { return this.#registry.unregister(id); }
    updateWindow(id, patch) { return this.#registry.update(id, patch); }
    setActiveWindow(id) { return this.#registry.setActive(id); }
    hasWindow(id) { return this.#registry.has(id); }
    getWindow(id) { return this.#registry.get(id); }
    getWindows(options) { return this.#registry.getAll(options); }
    getActiveWindow() { return this.#registry.getActive(); }

    // Layout

    getTopBarHeight() { return this.#elements.topbar.offsetHeight; }
    getTaskBarHeight() { return this.#elements.taskbar.offsetHeight; }

    /** Workspace size minus the navigator column and a 10 px bottom margin. */
    getUsableSize() {
        const { surface, navigator } = this.#elements;
        return getUsableSize(
            { width: surface.clientWidth, height: surface.clientHeight },
            { navigatorWidth: navigator.offsetWidth }
        );
    }

    getSizeAndPosition(maxWidth, maxHeight) {
        return this.#registry.getSizeAndPosition(this.getUsableSize(), {
            maxWidth: maxWidth ?? undefined,
            maxHeight: maxHeight ?? undefined
        });
    }

    getLayout(mode, count) {
        return getLayout(mode, count, this.getUsableSize(), ORIGIN);
    }

    focusSearch() {
        this.#elements.topbar.focusSearch();
    }

    /**
     * Announces `message` through the polite live region.
     * The region is cleared first and filled on the next frame, so the same text is announced again.
     */
    announce(message) {
        const region = this.#elements.status;
        const token = ++this.#announceToken;
        region.textContent = '';
        if (message === null || message === undefined || message === '') return;

        const text = String(message);
        requestAnimationFrame(() => {
            if (token !== this.#announceToken) return;
            region.textContent = text;
        });
    }

    // Internals

    #syncWindows() {
        if (!this.isConnected) return;

        const { taskbar } = this.#elements;
        taskbar.windows = this.#registry.getTaskbarItems();
        taskbar.concordanceNavigatorOpen = this.concordanceNavigatorOpen;
    }

    #syncLabels() {
        const labels = mergeLabels(DESKTOP_LABELS, this.getAttribute('labels'));
        this.#elements.workspace.setAttribute('aria-label', labels.workspace);
    }

    #syncLang() {
        const lang = this.getAttribute('lang') || this.parentElement?.closest('[lang]')?.lang || null;
        forwardAttribute(this.#elements.taskbar, 'lang', lang);
    }

    #updateMetrics() {
        const metrics = {
            usableSize: this.getUsableSize(),
            topBarHeight: this.getTopBarHeight(),
            taskBarHeight: this.getTaskBarHeight()
        };
        if (sameMetrics(metrics, this.#metrics)) return;

        this.#metrics = metrics;
        dispatch(this, 'desktop-resize', { ...metrics, usableSize: { ...metrics.usableSize } });
    }

    #onSortRequest = (event) => {
        if (!event.detail) return;
        event.detail.rects = this.#registry.getSortRects(event.detail.mode, this.getUsableSize(), ORIGIN);
        const key = SORT_ANNOUNCEMENTS[event.detail.mode];
        if (key) this.announce(this.#elements.taskbar.labels[key]);
    };

    #onCloseRequest = (event) => {
        const detail = event.detail;
        if (!detail) return;
        detail.ids = closeRequestIds(detail.scope, detail.id, this.#registry.getAll());
        if (detail.ids.length > 1) {
            const message = this.#elements.taskbar.labels.windowsClosed
                .replaceAll('{count}', String(detail.ids.length));
            this.announce(message);
        }
    };
}

function forwardAttribute(element, name, value) {
    if (value === null || value === undefined) element.removeAttribute(name);
    else element.setAttribute(name, value);
}

function setOrRemove(element, name, value) {
    forwardAttribute(element, name, value === null || value === undefined ? null : String(value));
}

if (!customElements.get('edirom-desktop')) {
    customElements.define('edirom-desktop', EdiromDesktop);
}
