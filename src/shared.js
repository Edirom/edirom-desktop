export const THEME_TOKENS = `
    --_ed-primary: var(--primary-color, #000000);
    --_ed-secondary: var(--secondary-color, #cacaca);
    --_ed-bar-background: var(--edirom-desktop-bar-background, #cccccc);
    --_ed-muted: var(--edirom-desktop-muted-color, #666666);
    --_ed-font: var(--edirom-desktop-font, 13px/1.3 helvetica, arial, verdana, sans-serif);
`;

export function parseJson(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        console.warn('edirom-desktop: ignoring invalid JSON attribute value', value, error);
        return fallback;
    }
}

/** Defaults overridden by the known keys of `value` (an object or a JSON string). */
export function mergeLabels(defaults, value) {
    const overrides = parseJson(value, {});
    const merged = { ...defaults };
    if (overrides && typeof overrides === 'object') {
        for (const key of Object.keys(defaults)) {
            if (typeof overrides[key] === 'string') merged[key] = overrides[key];
        }
    }
    return merged;
}

export function normalizeWorks(value) {
    const works = parseJson(value, []);
    if (!Array.isArray(works)) return [];
    return works
        .filter((work) => work && work.id !== undefined && work.id !== null)
        .map((work) => ({ id: String(work.id), title: work.title ? String(work.title) : String(work.id) }));
}

export function dispatch(target, type, detail = null) {
    return target.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

export function toggleAttribute(element, name, force) {
    if (force) element.setAttribute(name, '');
    else element.removeAttribute(name);
}
