import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    findOptimalLenBrt,
    gridDimensions,
    gridLayout,
    verticalLayout,
    horizontalLayout,
    getLayout,
    getUsableSize,
    getSizeAndPosition,
    hasWindowOnPosition
} from '../src/layout.js';
import * as legacy from './legacy-ext.js';

const SIZES = [
    { width: 1200, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 1000, height: 700 }
];

function toArray(positions) {
    return Object.keys(positions)
        .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))
        .map((key) => positions[key]);
}

function assertRectsClose(actual, expected) {
    assert.equal(actual.length, expected.length);
    actual.forEach((rect, i) => {
        for (const key of ['x', 'y', 'width', 'height']) {
            assert.ok(
                Math.abs(rect[key] - expected[i][key]) < 1e-9,
                `rect ${i}.${key}: ${rect[key]} != ${expected[i][key]}`
            );
        }
    });
}

describe('findOptimalLenBrt', () => {
    it('matches the ExtJS implementation for 1..64 windows', () => {
        for (let n = 1; n <= 64; n++) {
            assert.deepEqual(findOptimalLenBrt(n), legacy.findOptimalLenBrt(n), `n = ${n}`);
        }
    });

    it('rounds prime counts up so the grid is not a single row', () => {
        assert.deepEqual(findOptimalLenBrt(3), [2, 2]);
        assert.deepEqual(findOptimalLenBrt(5), [3, 2]);
        assert.deepEqual(findOptimalLenBrt(7), [4, 2]);
    });

    it('always provides at least as many cells as windows', () => {
        for (let n = 1; n <= 64; n++) {
            const { columns, rows } = gridDimensions(n);
            assert.ok(columns * rows >= n, `n = ${n}`);
            assert.ok(columns >= rows, `n = ${n}`);
        }
    });
});

// The ExtJS grid adds up cell widths and wraps when the sum exceeds the width,
// so rounding errors can wrap one window too early and push the last ones
// below the grid. gridLayout uses the index instead.
function legacyWrapsEarly(rects, columns) {
    const rowLengths = new Map();
    for (const rect of rects) rowLengths.set(rect.y, (rowLengths.get(rect.y) ?? 0) + 1);
    const lengths = [...rowLengths.values()];
    return lengths.slice(0, -1).some((length) => length < columns);
}

describe('tiling layouts match ExtJS', () => {
    for (const size of SIZES) {
        it(`grid at ${size.width}x${size.height}`, () => {
            for (let n = 1; n <= 24; n++) {
                const expected = toArray(legacy.getGridPositioning(n, size));
                if (legacyWrapsEarly(expected, gridDimensions(n).columns)) continue;
                assertRectsClose(gridLayout(n, size), expected);
            }
        });

        it(`vertical at ${size.width}x${size.height}`, () => {
            for (let n = 1; n <= 24; n++) {
                assertRectsClose(verticalLayout(n, size), toArray(legacy.getVerticalPositioning(n, size)));
            }
        });

        it(`horizontal at ${size.width}x${size.height}`, () => {
            for (let n = 1; n <= 24; n++) {
                assertRectsClose(horizontalLayout(n, size), toArray(legacy.getHorizontalPositioning(n, size)));
            }
        });
    }
});

describe('tiling layouts', () => {
    it('returns no rects for zero windows', () => {
        assert.deepEqual(gridLayout(0, SIZES[0]), []);
        assert.deepEqual(verticalLayout(0, SIZES[0]), []);
        assert.deepEqual(horizontalLayout(0, SIZES[0]), []);
    });

    it('shifts every rect by the origin', () => {
        const origin = { x: 0, y: 41 };
        for (const mode of ['grid', 'vertical', 'horizontal']) {
            const base = getLayout(mode, 5, SIZES[0]);
            const shifted = getLayout(mode, 5, SIZES[0], origin);
            shifted.forEach((rect, i) => {
                assert.equal(rect.x, base[i].x + origin.x);
                assert.equal(rect.y, base[i].y + origin.y);
                assert.equal(rect.width, base[i].width);
                assert.equal(rect.height, base[i].height);
            });
        }
    });

    it('lays out a 2x2 grid for 4 windows', () => {
        assert.deepEqual(gridLayout(4, { width: 1000, height: 600 }), [
            { x: 3, y: 2, width: 494, height: 296 },
            { x: 503, y: 2, width: 494, height: 296 },
            { x: 3, y: 302, width: 494, height: 296 },
            { x: 503, y: 302, width: 494, height: 296 }
        ]);
    });

    it('keeps grid rows when cell widths are not exact in floating point', () => {
        const size = { width: 1440, height: 900 };
        const expected = toArray(legacy.getGridPositioning(14, size));
        assert.equal(legacyWrapsEarly(expected, 7), true, 'ExtJS reference should show the wrapping bug');

        const rects = gridLayout(14, size);
        assert.deepEqual([...new Set(rects.map((r) => r.y))], [2, 452]);
        assert.ok(rects.every((r) => r.y + r.height <= size.height));
    });

    it('rejects unknown modes', () => {
        assert.throws(() => getLayout('cascade', 2, SIZES[0]), RangeError);
    });
});

describe('getUsableSize', () => {
    it('subtracts the navigator width and a 10px bottom margin by default', () => {
        assert.deepEqual(getUsableSize({ width: 1200, height: 800 }, { navigatorWidth: 250 }), { width: 950, height: 790 });
    });

    it('works without a navigator', () => {
        assert.deepEqual(getUsableSize({ width: 1200, height: 800 }), { width: 1200, height: 790 });
    });
});

describe('getSizeAndPosition', () => {
    const usable = { width: 950, height: 790 };

    it('matches ExtJS on an empty desktop', () => {
        assert.deepEqual(getSizeAndPosition(usable), legacy.getSizeAndPosition(usable, []));
    });

    it('cascades away from occupied positions like ExtJS', () => {
        const windows = [
            { x: 10, y: 5, hidden: false, minimized: false },
            { x: 32, y: 21, hidden: false, minimized: false },
            { x: 50, y: 35, hidden: false, minimized: false }
        ];
        const expected = legacy.getSizeAndPosition(usable, windows);
        const actual = getSizeAndPosition(usable, windows.map(({ x, y }) => ({ x, y })));

        assert.deepEqual(actual, expected);
        assert.deepEqual(actual, { width: 553.3333333333334, height: 725, x: 70, y: 50 });
    });

    it('applies max width and height like ExtJS', () => {
        assert.deepEqual(
            getSizeAndPosition(usable, [], { maxWidth: 700, maxHeight: 600 }),
            legacy.getSizeAndPosition(usable, [], 700, 600)
        );
    });

    it('never goes below 300px before cascading', () => {
        assert.deepEqual(getSizeAndPosition({ width: 200, height: 200 }), { width: 300, height: 300, x: 10, y: 5 });
    });

    it('treats positions within 10px as occupied', () => {
        assert.equal(hasWindowOnPosition([{ x: 19, y: 14 }], { x: 10, y: 5 }), true);
        assert.equal(hasWindowOnPosition([{ x: 20, y: 5 }], { x: 10, y: 5 }), false);
    });
});
