import { JSDOM } from 'jsdom';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.customElements = window.customElements;
globalThis.EventTarget = window.EventTarget;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);

await import('../src/edirom-desktop.js');

function tabStops(toolbar) {
    return [...toolbar.querySelectorAll('button')].filter((button) => button.tabIndex === 0);
}

describe('edirom-desktop ARIA contract', () => {
    it('exposes landmarks, toolbar names, task button semantics and one tab stop per toolbar', () => {
        const desktop = document.createElement('edirom-desktop');
        document.body.append(desktop);
        desktop.registerWindow({ id: 'score', title: 'Score' });
        desktop.registerWindow({ id: 'text', title: 'Text' });

        const topbar = desktop.shadowRoot.querySelector('edirom-topbar').shadowRoot;
        const taskbar = desktop.shadowRoot.querySelector('edirom-taskbar').shadowRoot;

        const banner = topbar.querySelector('.bar');
        assert.equal(banner.getAttribute('role'), 'banner');
        assert.equal(banner.getAttribute('aria-label'), 'Top bar');

        const main = desktop.shadowRoot.querySelector('.workspace');
        assert.equal(main.getAttribute('role'), 'main');
        assert.equal(main.getAttribute('aria-label'), 'Workspace');

        const region = taskbar.querySelector('.bar');
        assert.equal(region.getAttribute('role'), 'region');
        assert.equal(region.getAttribute('aria-label'), 'Task bar');

        assert.equal(taskbar.querySelector('[part="tools-start"]').getAttribute('aria-label'), 'Window tools');
        assert.equal(taskbar.querySelector('[part="tools-end"]').getAttribute('aria-label'), 'Help and settings');
        assert.equal(taskbar.querySelector('[part="window-bar"]').getAttribute('aria-label'), 'Open windows');

        const tasks = [...taskbar.querySelectorAll('.task')];
        assert.equal(tasks.length, 2);
        for (const button of tasks) {
            assert.equal(button.hasAttribute('aria-haspopup'), false);
            assert.equal(button.getAttribute('aria-keyshortcuts'), 'Shift+F10');
        }

        const toolbars = [...taskbar.querySelectorAll('[role="toolbar"]')];
        assert.equal(toolbars.length, 3);
        for (const toolbar of toolbars) {
            assert.equal(tabStops(toolbar).length, 1);
        }
        assert.equal(tabStops(taskbar.querySelector('[part="window-bar"]'))[0].dataset.id, 'text');
    });
});
