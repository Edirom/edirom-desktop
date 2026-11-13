/**
 * Pure layout math for the Edirom desktop: usable area, default window
 * placement and the grid / vertical / horizontal tiling modes.
 *
 * All rects are `{ x, y, width, height }` in pixels.
 */

export const LAYOUT_MODES = Object.freeze(['grid', 'vertical', 'horizontal']);

const CELL_MARGIN_X = 3;
const CELL_MARGIN_Y = 2;

export function isPrime(number) {
    for (let i = 2; i <= number / 2 + 1; i++) {
        if (number % i === 0) {
            return false;
        }
    }
    return true;
}

/**
 * Returns `[columns, rows]` for `number` windows. Prime counts are rounded up
 * to the next number so the grid does not degrade into a single row.
 */
export function findOptimalLenBrt(number) {
    if (number === 1) return [1, 1];
    if (number === 2) return [2, 1];

    if (isPrime(number)) {
        number = number + 1;
    }

    let diff = number;
    let opti;
    let optj;

    for (let i = 1; i <= number / 2; i++) {
        if (number % i !== 0) continue;

        const j = number / i;
        const tmpDiff = j - i;

        if (tmpDiff < diff && tmpDiff >= 0) {
            diff = tmpDiff;
            opti = i;
            optj = j;
        }
    }

    if (optj < opti) return [opti, optj];
    return [optj, opti];
}

export function gridDimensions(count) {
    const [columns, rows] = findOptimalLenBrt(count);
    return { columns, rows };
}

/**
 * Area available for windows: the desktop surface minus the navigator column
 * and a bottom margin.
 */
export function getUsableSize(surface, { navigatorWidth = 0, bottomMargin = 10 } = {}) {
    return {
        width: surface.width - navigatorWidth,
        height: surface.height - bottomMargin
    };
}

function cell(x, y, width, height) {
    return {
        x: x + CELL_MARGIN_X,
        y: y + CELL_MARGIN_Y,
        width: width - 2 * CELL_MARGIN_X,
        height: height - 2 * CELL_MARGIN_Y
    };
}

export function gridLayout(count, size, origin = { x: 0, y: 0 }) {
    if (count <= 0) return [];

    const { columns, rows } = gridDimensions(count);
    const cellWidth = size.width / columns;
    const cellHeight = size.height / rows;
    const rects = [];

    for (let i = 0; i < count; i++) {
        const column = i % columns;
        const row = Math.floor(i / columns);
        rects.push(cell(origin.x + column * cellWidth, origin.y + row * cellHeight, cellWidth, cellHeight));
    }

    return rects;
}

export function verticalLayout(count, size, origin = { x: 0, y: 0 }) {
    if (count <= 0) return [];

    const cellHeight = size.height / count;
    const rects = [];

    for (let i = 0; i < count; i++) {
        rects.push(cell(origin.x, origin.y + i * cellHeight, size.width, cellHeight));
    }

    return rects;
}

export function horizontalLayout(count, size, origin = { x: 0, y: 0 }) {
    if (count <= 0) return [];

    const cellWidth = size.width / count;
    const rects = [];

    for (let i = 0; i < count; i++) {
        rects.push(cell(origin.x + i * cellWidth, origin.y, cellWidth, size.height));
    }

    return rects;
}

export function getLayout(mode, count, size, origin) {
    switch (mode) {
        case 'grid': return gridLayout(count, size, origin);
        case 'vertical': return verticalLayout(count, size, origin);
        case 'horizontal': return horizontalLayout(count, size, origin);
        default: throw new RangeError(`Unknown layout mode "${mode}", expected one of ${LAYOUT_MODES.join(', ')}`);
    }
}

const PLACEMENT_START = Object.freeze({ x: 10, y: 5 });
const PLACEMENT_STEP = Object.freeze({ x: 20, y: 15 });
const PLACEMENT_MIN_SIZE = 300;
const PLACEMENT_TOLERANCE = 10;

export function hasWindowOnPosition(occupied, position) {
    return occupied.some((p) =>
        Math.abs(p.x - position.x) < PLACEMENT_TOLERANCE &&
        Math.abs(p.y - position.y) < PLACEMENT_TOLERANCE
    );
}

/**
 * Default rect for a newly opened window: two thirds of the usable width,
 * cascaded away from the positions in `occupied` (top-left corners of the
 * visible, non-minimized windows).
 */
export function getSizeAndPosition(usableSize, occupied = [], { maxWidth, maxHeight } = {}) {
    let width = Math.max(PLACEMENT_MIN_SIZE, (usableSize.width / 3 * 2) - 20);
    let height = Math.max(PLACEMENT_MIN_SIZE, usableSize.height - 20);
    let position = { ...PLACEMENT_START };

    while (hasWindowOnPosition(occupied, position)) {
        position = { x: position.x + PLACEMENT_STEP.x, y: position.y + PLACEMENT_STEP.y };
        width -= PLACEMENT_STEP.x;
        height -= PLACEMENT_STEP.y;
    }

    if (maxWidth !== undefined) width = Math.min(maxWidth, width);
    if (maxHeight !== undefined) height = Math.min(maxHeight, height);

    return { width, height, x: position.x, y: position.y };
}
