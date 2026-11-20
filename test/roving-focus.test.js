import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { nextIndex } from '../src/roving-focus.js';

describe('nextIndex', () => {
    it('wraps ArrowLeft and ArrowRight', () => {
        assert.equal(nextIndex('ArrowRight', 0, 3), 1);
        assert.equal(nextIndex('ArrowRight', 2, 3), 0);
        assert.equal(nextIndex('ArrowLeft', 1, 3), 0);
        assert.equal(nextIndex('ArrowLeft', 0, 3), 2);
    });

    it('stays on the only item', () => {
        assert.equal(nextIndex('ArrowLeft', 0, 1), 0);
        assert.equal(nextIndex('ArrowRight', 0, 1), 0);
        assert.equal(nextIndex('Home', 0, 1), 0);
        assert.equal(nextIndex('End', 0, 1), 0);
    });

    it('jumps to the ends for Home and End', () => {
        assert.equal(nextIndex('Home', 2, 4), 0);
        assert.equal(nextIndex('End', 0, 4), 3);
    });

    it('leaves the index unchanged for other keys', () => {
        assert.equal(nextIndex('ArrowUp', 1, 3), 1);
        assert.equal(nextIndex('a', 1, 3), 1);
    });

    it('returns 0 when there is nothing to move through', () => {
        assert.equal(nextIndex('ArrowRight', 0, 0), 0);
        assert.equal(nextIndex('End', 2, -1), 0);
    });
});
