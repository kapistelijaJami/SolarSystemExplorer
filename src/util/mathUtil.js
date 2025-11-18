export function distance(start, end) {
    return Math.hypot(end.x - start.x, end.y - start.y);
}