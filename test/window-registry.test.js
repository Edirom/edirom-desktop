import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { WindowRegistry } from '../src/window-registry.js';
import { gridLayout } from '../src/layout.js';

function record(registry) {
    const events = [];
    registry.addEventListener('change', (e) => events.push(['change', e.detail]));
    registry.addEventListener('activechange', (e) => events.push(['activechange', e.detail]));
    return events;
}

describe('WindowRegistry', () => {
    let registry;

    beforeEach(() => {
        registry = new WindowRegistry();
    });

    describe('register / unregister', () => {
        it('registers a window with defaults', () => {
            const win = registry.register({ id: 'w1', title: 'Score' });
            assert.deepEqual({ ...win }, {
                id: 'w1',
                title: 'Score',
                icon: null,
                special: false,
                hiddenInTaskbar: false,
                hidden: false,
                minimized: false,
                maximized: false,
                rect: null
            });
            assert.equal(registry.size, 1);
            assert.equal(registry.has('w1'), true);
        });

        it('rejects missing and duplicate ids', () => {
            assert.throws(() => registry.register({ title: 'x' }), TypeError);
            registry.register({ id: 'w1' });
            assert.throws(() => registry.register({ id: 'w1' }), /already registered/);
        });

        it('returns false when unregistering an unknown window', () => {
            assert.equal(registry.unregister('nope'), false);
        });

        it('returns frozen snapshots that cannot change registry state', () => {
            registry.register({ id: 'w1', rect: { x: 1, y: 2, width: 3, height: 4 } });
            const win = registry.get('w1');
            assert.throws(() => { win.title = 'changed'; }, TypeError);
            assert.throws(() => { win.rect.x = 99; }, TypeError);
            assert.equal(registry.get('w1').rect.x, 1);
        });
    });

    describe('active window', () => {
        it('makes the most recently registered shown window active', () => {
            registry.register({ id: 'w1' });
            registry.register({ id: 'w2' });
            assert.equal(registry.getActiveId(), 'w2');
        });

        it('does not activate a window registered as hidden', () => {
            registry.register({ id: 'w1' });
            registry.register({ id: 'w2', hidden: true });
            assert.equal(registry.getActiveId(), 'w1');
        });

        it('setActive brings a window to the front and shows it', () => {
            registry.register({ id: 'w1' });
            registry.register({ id: 'w2' });
            registry.update('w1', { minimized: true });

            registry.setActive('w1');

            assert.equal(registry.getActiveId(), 'w1');
            assert.equal(registry.get('w1').minimized, false);
            assert.deepEqual(registry.getZOrder().map((w) => w.id), ['w2', 'w1']);
        });

        it('falls back to the next window in z-order when the active one is minimized', () => {
            registry.register({ id: 'w1' });
            registry.register({ id: 'w2' });
            registry.register({ id: 'w3' });
            registry.setActive('w1');

            registry.update('w1', { minimized: true });
            assert.equal(registry.getActiveId(), 'w3');
        });

        it('falls back when the active window is hidden or removed', () => {
            registry.register({ id: 'w1' });
            registry.register({ id: 'w2' });

            registry.update('w2', { hidden: true });
            assert.equal(registry.getActiveId(), 'w1');

            registry.unregister('w1');
            assert.equal(registry.getActiveId(), null);
            assert.equal(registry.getActive(), null);
        });

        it('fires activechange only when the active window changes', () => {
            const events = record(registry);
            registry.register({ id: 'w1' });
            registry.update('w1', { title: 'Renamed' });
            registry.register({ id: 'w2', hidden: true });

            assert.deepEqual(events, [
                ['change', { reason: 'register', id: 'w1' }],
                ['activechange', { id: 'w1', previousId: null }],
                ['change', { reason: 'update', id: 'w1' }],
                ['change', { reason: 'register', id: 'w2' }]
            ]);
        });
    });

    describe('update', () => {
        it('merges rect patches and clears with null', () => {
            registry.register({ id: 'w1', rect: { x: 0, y: 0, width: 100, height: 100 } });
            registry.update('w1', { rect: { x: 50 } });
            assert.deepEqual({ ...registry.get('w1').rect }, { x: 50, y: 0, width: 100, height: 100 });

            registry.update('w1', { rect: null });
            assert.equal(registry.get('w1').rect, null);
        });

        it('ignores unknown keys and refuses to change the id', () => {
            registry.register({ id: 'w1' });
            registry.update('w1', { id: 'other', foo: 'bar' });
            assert.equal(registry.has('w1'), true);
            assert.equal('foo' in registry.get('w1'), false);
        });

        it('throws for unknown windows', () => {
            assert.throws(() => registry.update('nope', {}), /not registered/);
            assert.throws(() => registry.setActive('nope'), /not registered/);
        });
    });

    describe('queries', () => {
        beforeEach(() => {
            registry.register({ id: 'score', title: 'Score' });
            registry.register({ id: 'search', title: 'Search', special: true, hiddenInTaskbar: true });
            registry.register({ id: 'text', title: 'Text' });
            registry.update('text', { minimized: true });
        });

        it('keeps registration order regardless of z-order', () => {
            registry.setActive('score');
            assert.deepEqual(registry.getAll().map((w) => w.id), ['score', 'search', 'text']);
        });

        it('filters special and minimized windows', () => {
            assert.deepEqual(registry.getAll({ excludeSpecial: true }).map((w) => w.id), ['score', 'text']);
            assert.deepEqual(
                registry.getAll({ excludeSpecial: true, excludeMinimized: true }).map((w) => w.id),
                ['score']
            );
        });

        it('lists task bar items without hidden-in-taskbar windows', () => {
            assert.deepEqual(registry.getTaskbarItems().map((i) => ({ ...i })), [
                { id: 'score', title: 'Score', icon: null, active: false, hidden: false, minimized: false, maximized: false },
                { id: 'text', title: 'Text', icon: null, active: false, hidden: false, minimized: true, maximized: false }
            ]);
            assert.equal(registry.getActiveId(), 'search');
        });

        it('reports visibility of special windows', () => {
            assert.equal(registry.isVisible('search'), true);
            registry.update('search', { hidden: true });
            assert.equal(registry.isVisible('search'), false);
            assert.equal(registry.isVisible('unknown'), false);
        });
    });

    describe('placement', () => {
        it('cascades new windows away from shown windows only', () => {
            const usable = { width: 950, height: 790 };
            registry.register({ id: 'w1', rect: { x: 10, y: 5, width: 600, height: 700 } });
            registry.register({ id: 'w2', rect: { x: 30, y: 20, width: 600, height: 700 }, minimized: true });

            const next = registry.getSizeAndPosition(usable);
            assert.equal(next.x, 30);
            assert.equal(next.y, 20);

            registry.update('w2', { minimized: false });
            assert.equal(registry.getSizeAndPosition(usable).x, 50);
        });
    });

    describe('getSortRects', () => {
        const usable = { width: 1200, height: 800 };
        const origin = { x: 0, y: 41 };

        beforeEach(() => {
            registry.register({ id: 'a' });
            registry.register({ id: 'nav', special: true });
            registry.register({ id: 'b' });
            registry.register({ id: 'c' });
            registry.register({ id: 'min' });
            registry.update('min', { minimized: true });
        });

        it('tiles non-special, non-minimized windows in registration order', () => {
            const rects = registry.getSortRects('horizontal', usable, origin);
            assert.deepEqual(Object.keys(rects), ['a', 'b', 'c']);
            assert.equal(rects.a.x, 3);
            assert.equal(rects.b.x, 403);
            assert.equal(rects.c.y, 43);
        });

        it('in grid mode skips hidden and maximized windows without freeing their share of the grid', () => {
            registry.update('b', { maximized: true });
            const rects = registry.getSortRects('grid', usable, origin);
            const cells = gridLayout(3, usable, origin);

            assert.deepEqual(Object.keys(rects), ['a', 'c']);
            assert.deepEqual(rects.a, cells[0]);
            assert.deepEqual(rects.c, cells[1]);
        });

        it('returns an empty map when there is nothing to tile', () => {
            const empty = new WindowRegistry();
            assert.deepEqual(empty.getSortRects('grid', usable, origin), {});
        });
    });

    it('clear removes everything and resets the active window', () => {
        registry.register({ id: 'w1' });
        const events = record(registry);
        registry.clear();

        assert.equal(registry.size, 0);
        assert.equal(registry.getActiveId(), null);
        assert.deepEqual(events.map(([type]) => type), ['change', 'activechange']);
    });
});
