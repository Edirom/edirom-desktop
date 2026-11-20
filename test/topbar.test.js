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

function topbarOf(desktop) {
    return desktop.shadowRoot.querySelector('edirom-topbar').shadowRoot;
}

describe('top bar work switch', () => {
    it('uses one work-title span for a single work and one select for several', () => {
        const desktop = document.createElement('edirom-desktop');
        document.body.append(desktop);
        const topbar = topbarOf(desktop);

        desktop.works = [{ id: 'work-1', title: 'Trüber Abschied (für Singstimme und Klavier)' }];
        desktop.activeWork = 'work-1';

        const single = topbar.querySelectorAll('.work-title');
        assert.equal(single.length, 1);
        assert.equal(single[0].tagName, 'SPAN');
        assert.equal(single[0].hidden, false);
        assert.equal(single[0].textContent, 'Trüber Abschied (für Singstimme und Klavier)');
        assert.equal(topbar.querySelector('select'), null);
        assert.equal(topbar.querySelector('button.work-switch'), null);
        assert.equal(topbar.querySelector('.separator').hidden, false);

        desktop.works = [
            { id: 'a', title: 'Edition A' },
            { id: 'b', title: 'Edition B' }
        ];
        desktop.activeWork = 'b';

        const several = topbar.querySelectorAll('.work-title');
        assert.equal(several.length, 1);
        assert.equal(several[0].tagName, 'SELECT');
        assert.equal(several[0].value, 'b');
        assert.deepEqual(
            [...several[0].options].map((option) => [option.value, option.textContent]),
            [['a', 'Edition A'], ['b', 'Edition B']]
        );

        several[0].value = 'a';
        several[0].dispatchEvent(new Event('change'));
        assert.equal(desktop.activeWork, 'a');

        desktop.works = [];
        const empty = topbar.querySelectorAll('.work-title');
        assert.equal(empty.length, 1);
        assert.equal(empty[0].tagName, 'SPAN');
        assert.equal(empty[0].hidden, true);
        assert.equal(topbar.querySelector('.separator').hidden, true);
    });
});
