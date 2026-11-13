import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseJson, mergeLabels, normalizeWorks, dispatch } from '../src/shared.js';
import { TOPBAR_LABELS } from '../src/labels.js';

describe('parseJson', () => {
    it('parses strings and passes other values through', () => {
        assert.deepEqual(parseJson('{"a":1}', null), { a: 1 });
        assert.deepEqual(parseJson([1], null), [1]);
    });

    it('returns the fallback for empty or invalid values', (t) => {
        t.mock.method(console, 'warn', () => {});
        assert.equal(parseJson(null, 'x'), 'x');
        assert.equal(parseJson('', 'x'), 'x');
        assert.equal(parseJson('{oops', 'x'), 'x');
        assert.equal(console.warn.mock.callCount(), 1);
    });
});

describe('mergeLabels', () => {
    it('overrides known string keys only', () => {
        const labels = mergeLabels(TOPBAR_LABELS, '{"search":"Suche","unknown":"x","home":5}');
        assert.equal(labels.search, 'Suche');
        assert.equal(labels.home, TOPBAR_LABELS.home);
        assert.equal('unknown' in labels, false);
    });

    it('accepts objects and missing values', () => {
        assert.equal(mergeLabels(TOPBAR_LABELS, { home: 'Start' }).home, 'Start');
        assert.deepEqual(mergeLabels(TOPBAR_LABELS, null), { ...TOPBAR_LABELS });
    });
});

describe('normalizeWorks', () => {
    it('keeps id and title as strings and falls back to the id', () => {
        assert.deepEqual(normalizeWorks('[{"id":1,"title":"Freischütz"},{"id":"w2"},{"title":"no id"}]'), [
            { id: '1', title: 'Freischütz' },
            { id: 'w2', title: 'w2' }
        ]);
    });

    it('returns an empty list for anything but an array', () => {
        assert.deepEqual(normalizeWorks('{"id":1}'), []);
        assert.deepEqual(normalizeWorks(null), []);
    });
});

describe('dispatch', () => {
    it('fires a bubbling, composed CustomEvent', () => {
        const target = new EventTarget();
        let received;
        target.addEventListener('search-request', (event) => { received = event; });

        dispatch(target, 'search-request', { term: 'Agathe' });

        assert.deepEqual(received.detail, { term: 'Agathe' });
        assert.equal(received.bubbles, true);
        assert.equal(received.composed, true);
    });
});
