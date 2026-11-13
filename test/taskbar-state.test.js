import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { taskButtonAction, windowMenuItems, windowMenuRequest, normalizeWindows, formatClock } from '../src/taskbar-state.js';
import { TASKBAR_LABELS } from '../src/labels.js';
import { WindowRegistry } from '../src/window-registry.js';

const shown = { id: 'w', active: false, hidden: false, minimized: false, maximized: false };

function disabledActions(item) {
    return windowMenuItems(item, TASKBAR_LABELS)
        .filter((entry) => !entry.separator && entry.disabled)
        .map((entry) => entry.id);
}

describe('taskButtonAction', () => {
    it('brings an inactive shown window to the front', () => {
        assert.equal(taskButtonAction(shown), 'focus');
    });

    it('minimizes the active window', () => {
        assert.equal(taskButtonAction({ ...shown, active: true }), 'minimize');
    });

    it('shows minimized and hidden windows', () => {
        assert.equal(taskButtonAction({ ...shown, minimized: true }), 'focus');
        assert.equal(taskButtonAction({ ...shown, hidden: true, active: true }), 'focus');
    });
});

describe('windowMenuItems', () => {
    it('only allows minimize, maximize and close for a normal window', () => {
        assert.deepEqual(disabledActions(shown), ['restore']);
    });

    it('allows restore but not maximize for a maximized window', () => {
        assert.deepEqual(disabledActions({ ...shown, maximized: true }), ['maximize']);
    });

    it('allows restore but not maximize or minimize for a minimized window', () => {
        assert.deepEqual(disabledActions({ ...shown, minimized: true, hidden: true }), ['minimize', 'maximize']);
    });

    it('uses the labels and keeps the ExtJS order', () => {
        const items = windowMenuItems(shown, { ...TASKBAR_LABELS, close: 'Schließen' });
        assert.deepEqual(
            items.map((entry) => entry.separator ? '-' : entry.id),
            ['restore', 'minimize', 'maximize', '-', 'close', '-', 'closeOther', 'closeAll']
        );
        assert.equal(items.find((entry) => entry.id === 'close').label, 'Schließen');
    });
});

describe('windowMenuRequest', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    it('maps state actions to request events', () => {
        assert.deepEqual(windowMenuRequest('restore', 'b', items), ['window-restore-request', { id: 'b' }]);
        assert.deepEqual(windowMenuRequest('minimize', 'b', items), ['window-minimize-request', { id: 'b' }]);
        assert.deepEqual(windowMenuRequest('maximize', 'b', items), ['window-maximize-request', { id: 'b' }]);
    });

    it('maps the close actions to one event with a scope', () => {
        assert.deepEqual(windowMenuRequest('close', 'b', items), ['window-close-request', { scope: 'window', id: 'b', ids: ['b'] }]);
        assert.deepEqual(windowMenuRequest('closeOther', 'b', items), ['window-close-request', { scope: 'others', id: 'b', ids: ['a', 'c'] }]);
        assert.deepEqual(windowMenuRequest('closeAll', 'b', items), ['window-close-request', { scope: 'all', id: 'b', ids: ['a', 'b', 'c'] }]);
    });

    it('rejects unknown actions', () => {
        assert.throws(() => windowMenuRequest('tile', 'a', items), RangeError);
    });
});

describe('normalizeWindows', () => {
    it('accepts registry task bar items unchanged', () => {
        const registry = new WindowRegistry();
        registry.register({ id: 'w1', title: 'Score', icon: 'description' });
        registry.register({ id: 'w2', title: 'Text', maximized: true });

        const items = registry.getTaskbarItems();
        assert.deepEqual(normalizeWindows(items), items.map((item) => ({ ...item })));
    });

    it('drops entries without id and coerces values', () => {
        assert.deepEqual(normalizeWindows([null, { title: 'x' }, { id: 7, active: 1 }]), [
            { id: '7', title: '', icon: null, active: true, hidden: false, minimized: false, maximized: false }
        ]);
        assert.deepEqual(normalizeWindows('nope'), []);
    });
});

describe('formatClock', () => {
    const date = new Date(2026, 10, 13, 16, 5);

    it('formats hours and minutes for the language', () => {
        assert.equal(formatClock(date, 'de'), '16:05');
        assert.match(formatClock(date, 'en-US'), /^4:05\sPM$/);
    });

    it('falls back to the default locale for invalid languages', () => {
        assert.equal(typeof formatClock(date, 'not a locale!'), 'string');
    });
});
