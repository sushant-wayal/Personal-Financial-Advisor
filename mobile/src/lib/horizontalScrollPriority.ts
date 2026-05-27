type HorizontalScrollState = {
    active: boolean;
    atStart: boolean;
    atEnd: boolean;
};

const horizontalScrollState: HorizontalScrollState = {
    active: false,
    atStart: false,
    atEnd: false,
};

export function beginHorizontalScroll() {
    horizontalScrollState.active = true;
}

export function updateHorizontalScroll(scrollX: number, layoutWidth: number, contentWidth: number) {
    const threshold = 8;
    horizontalScrollState.atStart = scrollX <= threshold;
    horizontalScrollState.atEnd = scrollX + layoutWidth >= contentWidth - threshold;
}

export function endHorizontalScroll() {
    horizontalScrollState.active = false;
    horizontalScrollState.atStart = false;
    horizontalScrollState.atEnd = false;
}

export function shouldStartAppSwipe(dx: number, dy: number) {
    const horizontalEnough = Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(dy) * 0.6;
    if (!horizontalEnough) return false;
    if (!horizontalScrollState.active) {
        return true;
    }

    if (horizontalScrollState.atStart && dx > 0) return true;
    if (horizontalScrollState.atEnd && dx < 0) return true;
    return false;
}