import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CONCORDANCE_NAVIGATOR_KIND, FORWARDED_ATTRIBUTES, isKindVisible, closeRequestIds, sameMetrics, cssUrl } from '../src/desktop-state.js';
import { WindowRegistry } from '../src/window-registry.js';

describe('isKindVisible', () => {
    it('is true only while a window of that kind is shown', () => {
        const registry = new WindowRegistry();
        registry.register({ id: 'w1' });
        assert.equal(isKindVisible(registry.getAll(), CONCORDANCE_NAVIGATOR_KIND), false);

        registry.register({ id: 'cn', kind: CONCORDANCE_NAVIGATOR_KIND, special: true, hiddenInTaskbar: true });
        assert.equal(isKindVisible(registry.getAll(), CONCORDANCE_NAVIGATOR_KIND), true);

        registry.update('cn', { hidden: true });
        assert.equal(isKindVisible(registry.getAll(), CONCORDANCE_NAVIGATOR_KIND), false);

        registry.update('cn', { hidden: false, minimized: true });
        assert.equal(isKindVisible(registry.getAll(), CONCORDANCE_NAVIGATOR_KIND), false);
    });
});

describe('closeRequestIds', () => {
    const windows = [{ id: 'a' }, { id: 'search' }, { id: 'c' }];

    it('closes a single window', () => {
        assert.deepEqual(closeRequestIds('window', 'c', windows), ['c']);
    });

    it('includes windows without a task button for "others" and "all"', () => {
        assert.deepEqual(closeRequestIds('others', 'a', windows), ['search', 'c']);
        assert.deepEqual(closeRequestIds('all', 'a', windows), ['a', 'search', 'c']);
    });

    it('rejects unknown scopes', () => {
        assert.throws(() => closeRequestIds('some', 'a', windows), RangeError);
    });
});

describe('sameMetrics', () => {
    const metrics = { usableSize: { width: 900, height: 600 }, topBarHeight: 41, taskBarHeight: 42 };

    it('compares sizes and bar heights by value', () => {
        assert.equal(sameMetrics(metrics, { ...metrics, usableSize: { ...metrics.usableSize } }), true);
        assert.equal(sameMetrics(metrics, { ...metrics, usableSize: { width: 650, height: 600 } }), false);
        assert.equal(sameMetrics(metrics, { ...metrics, topBarHeight: 0 }), false);
    });

    it('treats missing metrics as changed', () => {
        assert.equal(sameMetrics(metrics, null), false);
    });
});

describe('cssUrl', () => {
    it('quotes the URL and escapes characters that would end the string', () => {
        assert.equal(cssUrl('resources/wallpapers/Blue-Sencha.jpg'), 'url("resources/wallpapers/Blue-Sencha.jpg")');
        assert.equal(cssUrl('a"b\\c'), 'url("a\\22 b\\5c c")');
    });

    it('returns an empty value for no wallpaper', () => {
        assert.equal(cssUrl(null), '');
        assert.equal(cssUrl(''), '');
    });
});

describe('FORWARDED_ATTRIBUTES', () => {
    it('passes labels to both bars', () => {
        assert.ok(FORWARDED_ATTRIBUTES.topbar.includes('labels'));
        assert.ok(FORWARDED_ATTRIBUTES.taskbar.includes('labels'));
    });
});
