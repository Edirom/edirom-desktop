// Reference copy of the ExtJS desktop math from Edirom-Online-Frontend
// (app/controller/desktop/Desktop.js and app/view/desktop/Desktop.js).
// Only Ext collections were replaced by plain arrays; keep it otherwise unchanged.

export function isPrime(number) {
    for (var i = 2; i <= number / 2 + 1; i++) {
        if (number % i == 0) {
            return false;
        }
    }
    return true;
}

export function findOptimalLenBrt(number) {
    if (number == 1)
        return [1, 1];
    else if (number == 2)
        return [2, 1];

    var prime = isPrime(number);
    if (prime)
        number = number + 1;

    var diff = number;
    var j = 1;
    var opti;
    var optj;

    for (var i = 1; i <= number / 2; i++) {
        if (number % i != 0)
            continue;
        j = number / i;
        var tmpDiff = j - i;
        if (tmpDiff < diff && tmpDiff >= 0) {
            diff = tmpDiff;
            opti = i;
            optj = j;
        }
    }

    if (optj < opti)
        return [opti, optj];
    return [optj, opti];
}

export function getGridPositioning(numWins, size) {
    var positions = {};
    var left = 0;
    var top = 0;
    var optArray = findOptimalLenBrt(numWins);

    for (var i = 0; i < numWins; i++) {
        if ((left + (size.width / optArray[0])) > size.width) {
            top = top + (size.height / optArray[1]);
            left = 0;
        }
        positions['win_' + i] = {
            y: top + 2,
            x: left + 3,
            width: size.width / optArray[0] - 6,
            height: size.height / optArray[1] - 4
        };
        left = left + (size.width / optArray[0]);
    }
    return positions;
}

export function getHorizontalPositioning(numWins, size) {
    var w = size.width / numWins;
    var positions = {};
    var left = 0;
    var top = 0;

    for (var i = 0; i < numWins; i++) {
        positions['win_' + i] = {
            y: top + 2,
            x: left + 3,
            width: w - 6,
            height: size.height - 4
        };
        left = left + w;
    }
    return positions;
}

export function getVerticalPositioning(numWins, size) {
    var h = size.height / numWins;
    var positions = {};
    var left = 0;
    var top = 0;

    for (var i = 0; i < numWins; i++) {
        positions['win_' + i] = {
            y: top + 2,
            x: left + 3,
            width: size.width - 6,
            height: h - 4
        };
        top = top + h;
    }
    return positions;
}

// windows: [{ x, y, hidden, minimized }]
export function getSizeAndPosition(usableSize, windows, maxWidth, maxHeight) {
    function hasWindowOnPosition(position) {
        var found = false;
        windows.forEach(function (win) {
            if (!win.hidden
                && !win.minimized
                && Math.abs(win.x - position[0]) < 10
                && Math.abs(win.y - position[1]) < 10)
                found = true;
        });
        return found;
    }

    var width = Math.max(300, (usableSize.width / 3 * 2) - 20);
    var height = Math.max(300, usableSize.height - 20);

    var position = [10, 5];
    while (hasWindowOnPosition(position)) {
        position = [position[0] + 20, position[1] + 15];
        width -= 20;
        height -= 15;
    }

    if (typeof maxWidth != 'undefined') width = Math.min(maxWidth, width);
    if (typeof maxHeight != 'undefined') height = Math.min(maxHeight, height);

    return { width: width, height: height, x: position[0], y: position[1] };
}
