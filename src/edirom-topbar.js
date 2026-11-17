import { THEME_TOKENS, mergeLabels, normalizeWorks, dispatch } from './shared.js';
import { TOPBAR_LABELS } from './labels.js';
import { PopupMenu, MENU_STYLES } from './menu.js';

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
        gap: 8px;
        box-sizing: border-box;
        height: var(--edirom-topbar-height, 41px);
        padding: 0 8px 0 0;
        background: linear-gradient(
            color-mix(in srgb, var(--_ed-bar-background) 90%, white),
            var(--_ed-bar-background) 50%,
            color-mix(in srgb, var(--_ed-bar-background) 92%, black)
        );
        box-shadow: 0 0 1px #000000;
    }

    .start {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .home {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: var(--edirom-topbar-height, 41px);
        height: var(--edirom-topbar-height, 41px);
        padding: 3px;
        border: 0;
        background: none;
        color: inherit;
        cursor: pointer;
    }

    .home:focus-visible,
    .work-switch:focus-visible,
    .search-field:focus-visible {
        outline: 2px solid var(--_ed-primary);
        outline-offset: -2px;
    }

    .home img {
        max-width: 100%;
        max-height: 100%;
    }

    .home-label {
        color: var(--_ed-muted);
        font-size: 16px;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
        white-space: nowrap;
    }

    .home-label:empty {
        display: none;
    }

    .separator {
        flex: 0 0 auto;
        width: 0;
        height: 14px;
        border-left: 1px solid #8c8c8c;
        border-right: 1px solid #e6e6e6;
    }

    .work-switch {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        max-width: 40ch;
        min-height: 24px;
        padding: 0 6px 0 8px;
        border: 1px solid #949393;
        border-radius: 3px;
        background: linear-gradient(#dddddd, #c3c3c3 30%, #b8b8b8 65%, #a0a0a0);
        color: inherit;
        font: inherit;
        cursor: pointer;
    }

    .work-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .caret {
        flex: 0 0 auto;
        margin-top: 4px;
        border: 4px solid transparent;
        border-top-color: currentColor;
    }

    .search {
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 0;
    }

    .search-field {
        box-sizing: border-box;
        width: var(--edirom-topbar-search-width, 180px);
        min-height: 22px;
        padding: 2px 4px;
        border: 1px solid #b5b8c8;
        background: #ffffff;
        color: #000000;
        font: inherit;
    }

    .actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    ${MENU_STYLES}
</style>
<div class="bar" part="bar" role="banner">
    <div class="start">
        <button type="button" class="home" part="home-button">
            <slot name="logo"><edirom-icon name="home"></edirom-icon></slot>
        </button>
        <span class="home-label" part="home-label"></span>
        <span class="separator" aria-hidden="true"></span>
        <button type="button" class="work-switch" part="work-switch" aria-haspopup="menu" aria-expanded="false">
            <span class="work-title"></span>
            <span class="caret" aria-hidden="true"></span>
        </button>
    </div>
    <form class="search" part="search" role="search">
        <input type="search" class="search-field" part="search-field" autocomplete="off">
        <edirom-icon class="search-button" part="search-button" role="button" name="search"></edirom-icon>
    </form>
    <div class="actions" part="actions"><slot name="actions"></slot></div>
</div>
`;

/**
 * Top bar of the Edirom desktop: home button, work switcher, search field and
 * a slot for further actions (e.g. the connected workspace).
 *
 * Events: `home-request`, `work-select` ({ workId, previousWorkId }),
 * `search-request` ({ term }).
 */
export class EdiromTopbar extends HTMLElement {
    static observedAttributes = ['works', 'active-work', 'labels', 'logo'];

    #labels = { ...TOPBAR_LABELS };
    #works = [];
    #elements;
    #workMenu;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.append(template.content.cloneNode(true));

        this.#elements = {
            bar: shadow.querySelector('.bar'),
            home: shadow.querySelector('.home'),
            homeLabel: shadow.querySelector('.home-label'),
            logoSlot: shadow.querySelector('slot[name="logo"]'),
            workSwitch: shadow.querySelector('.work-switch'),
            workTitle: shadow.querySelector('.work-title'),
            search: shadow.querySelector('.search'),
            searchField: shadow.querySelector('.search-field'),
            searchButton: shadow.querySelector('.search-button')
        };

        this.#workMenu = new PopupMenu({
            checkable: true,
            onSelect: (workId) => this.#selectWork(workId),
            onToggle: (open) => this.#elements.workSwitch.setAttribute('aria-expanded', String(open))
        });
        shadow.append(this.#workMenu.element);

        this.#elements.home.addEventListener('click', () => dispatch(this, 'home-request'));
        this.#elements.workSwitch.addEventListener('click', () => this.#workMenu.toggle(this.#elements.workSwitch));
        this.#elements.workSwitch.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                this.#workMenu.open(this.#elements.workSwitch);
            }
        });
        this.#elements.search.addEventListener('submit', (event) => {
            event.preventDefault();
            this.#requestSearch();
        });
        this.#elements.searchButton.addEventListener('click', () => this.#requestSearch());
    }

    connectedCallback() {
        this.#render();
    }

    disconnectedCallback() {
        this.#workMenu.close();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'works':
                this.#works = normalizeWorks(newValue);
                break;
            case 'labels':
                this.#labels = mergeLabels(TOPBAR_LABELS, newValue);
                break;
        }
        this.#render();
    }

    get works() {
        return this.#works.map((work) => ({ ...work }));
    }

    set works(value) {
        this.setAttribute('works', typeof value === 'string' ? value : JSON.stringify(value ?? []));
    }

    get activeWork() {
        return this.getAttribute('active-work');
    }

    set activeWork(value) {
        if (value === null || value === undefined) this.removeAttribute('active-work');
        else this.setAttribute('active-work', String(value));
    }

    get labels() {
        return { ...this.#labels };
    }

    set labels(value) {
        this.setAttribute('labels', typeof value === 'string' ? value : JSON.stringify(value ?? {}));
    }

    get searchValue() {
        return this.#elements.searchField.value;
    }

    set searchValue(value) {
        this.#elements.searchField.value = value ?? '';
    }

    focusSearch() {
        this.#elements.searchField.focus();
    }

    #selectWork(workId) {
        const previousWorkId = this.activeWork;
        if (workId === previousWorkId) return;

        this.activeWork = workId;
        dispatch(this, 'work-select', { workId, previousWorkId });
    }

    #requestSearch() {
        dispatch(this, 'search-request', { term: this.#elements.searchField.value });
    }

    #render() {
        const labels = this.#labels;
        const { bar, home, homeLabel, logoSlot, workSwitch, workTitle, searchField, searchButton } = this.#elements;

        bar.setAttribute('aria-label', labels.topbar);
        home.setAttribute('aria-label', labels.home);
        home.title = labels.home;
        homeLabel.textContent = labels.homeLabel;

        const logo = this.getAttribute('logo');
        if (logo) {
            const img = document.createElement('img');
            img.src = logo;
            img.alt = '';
            logoSlot.replaceChildren(img);
        } else if (!logoSlot.querySelector('edirom-icon')) {
            const icon = document.createElement('edirom-icon');
            icon.setAttribute('name', 'home');
            logoSlot.replaceChildren(icon);
        }

        const activeWork = this.activeWork;
        const active = this.#works.find((work) => work.id === activeWork);
        workTitle.textContent = active ? active.title : labels.workSwitch;
        workSwitch.title = labels.workSwitch;
        if (active) workSwitch.setAttribute('aria-label', `${labels.workSwitch}: ${active.title}`);
        else workSwitch.removeAttribute('aria-label');
        workSwitch.hidden = this.#works.length === 0;
        this.shadowRoot.querySelector('.separator').hidden = this.#works.length === 0;

        this.#workMenu.setLabel(labels.workSwitch);
        this.#workMenu.emptyLabel = labels.noWorks;
        this.#workMenu.setItems(this.#works.map((work) => ({
            id: work.id,
            label: work.title,
            checked: work.id === activeWork
        })));

        searchField.placeholder = labels.searchField;
        searchField.setAttribute('aria-label', labels.searchField);
        searchButton.title = labels.search;
        searchButton.setAttribute('aria-label', labels.search);
    }
}

if (!customElements.get('edirom-topbar')) {
    customElements.define('edirom-topbar', EdiromTopbar);
}
