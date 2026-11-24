import { THEME_TOKENS, mergeLabels, normalizeWorks, dispatch } from './shared.js';
import { TOPBAR_LABELS } from './labels.js';

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
    select.work-title:focus-visible,
    .search-field:focus-visible,
    .search-button:focus-visible {
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

    .work-title {
        min-width: 0;
        max-width: 40ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    select.work-title {
        max-width: 40ch;
        font: inherit;
        color: inherit;
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

    .search-button {
        display: inline-flex;
        flex: 0 0 auto;
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

    .search-button:hover {
        background-color: color-mix(in oklch, var(--_ed-secondary) 97%, black);
        box-shadow: 0 1px 1px rgba(8, 8, 8, 0.45) inset;
    }

    .actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

</style>
<div class="bar" part="bar" role="banner">
    <div class="start">
        <button type="button" class="home" part="home-button">
            <slot name="logo"><edirom-icon name="home"></edirom-icon></slot>
        </button>
        <span class="home-label" part="home-label"></span>
        <span class="separator" aria-hidden="true"></span>
        <span class="work-title" part="work-switch" hidden></span>
    </div>
    <form class="search" part="search" role="search">
        <input type="search" class="search-field" part="search-field" autocomplete="off">
        <button type="submit" class="search-button" part="search-button"><edirom-icon name="search" aria-hidden="true"></edirom-icon></button>
    </form>
    <div class="actions" part="actions"><slot name="actions"></slot></div>
</div>
`;

/**
 * Top bar of the Edirom desktop: home button, work switcher, search field and
 * a slot for further actions (e.g. the connected workspace).
 *
 * One entry is plain text. Several entries are a native select. The list is hidden when empty.
 *
 * Events: `home-request`, `work-select` ({ workId, previousWorkId }),
 * `search-request` ({ term }).
 */
export class EdiromTopbar extends HTMLElement {
    static observedAttributes = ['works', 'active-work', 'labels', 'logo'];

    #labels = { ...TOPBAR_LABELS };
    #works = [];
    #elements;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.append(template.content.cloneNode(true));

        this.#elements = {
            bar: shadow.querySelector('.bar'),
            home: shadow.querySelector('.home'),
            homeLabel: shadow.querySelector('.home-label'),
            logoSlot: shadow.querySelector('slot[name="logo"]'),
            separator: shadow.querySelector('.separator'),
            workSwitch: shadow.querySelector('.work-title'),
            search: shadow.querySelector('.search'),
            searchField: shadow.querySelector('.search-field'),
            searchButton: shadow.querySelector('.search-button')
        };

        this.#elements.home.addEventListener('click', () => dispatch(this, 'home-request'));
        this.#elements.search.addEventListener('submit', (event) => {
            event.preventDefault();
            this.#requestSearch();
        });
    }

    connectedCallback() {
        this.#render();
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

    /** One `work-title`: a span for a single work, a select when there are several. */
    #workElement(multiple) {
        const current = this.#elements.workSwitch;
        if ((current.tagName === 'SELECT') === multiple) return current;

        const next = multiple ? this.#createWorkSelect() : this.#createWorkTitle();
        current.replaceWith(next);
        this.#elements.workSwitch = next;
        return next;
    }

    #createWorkTitle() {
        const title = document.createElement('span');
        title.className = 'work-title';
        title.part = 'work-switch';
        return title;
    }

    #createWorkSelect() {
        const select = document.createElement('select');
        select.className = 'work-title';
        select.part = 'work-switch';
        select.addEventListener('change', () => this.#selectWork(select.value));
        return select;
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
        const { bar, home, homeLabel, logoSlot, separator, searchField, searchButton } = this.#elements;

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

        const choices = this.#works;
        const multiple = choices.length > 1;
        const active = choices.find((work) => work.id === this.activeWork) ?? (choices.length === 1 ? choices[0] : null);

        separator.hidden = choices.length === 0;

        const workSwitch = this.#workElement(multiple);
        workSwitch.hidden = choices.length === 0;

        if (multiple) {
            const signature = JSON.stringify(choices);
            if (workSwitch.dataset.works !== signature) {
                workSwitch.replaceChildren(...choices.map((work) => {
                    const option = document.createElement('option');
                    option.value = work.id;
                    option.textContent = work.title;
                    return option;
                }));
                workSwitch.dataset.works = signature;
            }
            if (active) workSwitch.value = active.id;
            workSwitch.setAttribute('aria-label', labels.workSwitch);
        } else {
            workSwitch.textContent = active ? active.title : '';
        }

        searchField.placeholder = labels.searchField;
        searchField.setAttribute('aria-label', labels.searchField);
        searchButton.title = labels.search;
        searchButton.setAttribute('aria-label', labels.search);
    }
}

if (!customElements.get('edirom-topbar')) {
    customElements.define('edirom-topbar', EdiromTopbar);
}
