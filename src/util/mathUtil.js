export function distance2D(start, end) {
    return Math.hypot(end.x - start.x, end.y - start.y);
}

export function distance3D(start, end) {
    return Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
}