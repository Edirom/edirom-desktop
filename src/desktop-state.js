export const CONCORDANCE_NAVIGATOR_KIND = 'concordance-navigator';

/** Attributes of `<edirom-desktop>` that are passed on to the bars unchanged. */
export const FORWARDED_ATTRIBUTES = Object.freeze({
    topbar: Object.freeze(['works', 'active-work', 'labels', 'logo']),
    taskbar: Object.freeze(['labels', 'lang', 'measures-visible', 'annotations-visible', 'show-clock', 'show-language-switch'])
});

export function isKindVisible(windows, kind) {
    return windows.some((w) => w.kind === kind && !w.hidden && !w.minimized);
}

/**
 * Ids affected by a window menu close action. "Close others" and "close all"
 * include windows without a task button, as the ExtJS desktop did.
 */
export function closeRequestIds(scope, id, windows) {
    switch (scope) {
        case 'window': return [id];
        case 'others': return windows.map((w) => w.id).filter((other) => other !== id);
        case 'all': return windows.map((w) => w.id);
        default: throw new RangeError(`Unknown close scope "${scope}"`);
    }
}

export function sameMetrics(a, b) {
    return Boolean(a && b) &&
        a.usableSize.width === b.usableSize.width &&
        a.usableSize.height === b.usableSize.height &&
        a.topBarHeight === b.topBarHeight &&
        a.taskBarHeight === b.taskBarHeight;
}

/** CSS `background-image` value for a wallpaper URL, or `''` for none. */
export function cssUrl(value) {
    if (!value) return '';
    const escaped = String(value).replace(/["\\\n\r\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `);
    return `url("${escaped}")`;
}
