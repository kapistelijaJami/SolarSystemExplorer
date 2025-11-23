import * as THREE from 'three';
import { normalizeTime } from "@/util/timeUtil";

export function distance2D(start, end) {
    return Math.hypot(end.x - start.x, end.y - start.y);
}

export function distance3D(start, end) {
    return Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
}

export function radiansToDegrees(radians) {
    return radians * (180 / Math.PI);
};

export function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

export function hermiteInterpolationVec(params) {
    return hermiteInterpolation(params[0], params[1], params[2], params[3], params[4], params[5], params[6]);
}

export function hermiteInterpolation(jdTDB, t0, t1, p0, p1, v0, v1) {
    if (t0 === t1) {
        return [p0.clone(), v0.clone()];
    }
    const t = normalizeTime(jdTDB, t0, t1);
    const secondsPerDay = 86400;
    const dt = (t1 - t0) * secondsPerDay;

    const h0 = 2 * t ** 3 - 3 * t ** 2 + 1; //Weight of p0
    const h1 = -2 * t ** 3 + 3 * t ** 2;    //Weight of p1
    const h2 = t ** 3 - 2 * t ** 2 + t;     //Weight of v0
    const h3 = t ** 3 - t ** 2;             //Weight of v1

    const dh0 = (6 * t ** 2 - 6 * t) / dt;
    const dh1 = (-6 * t ** 2 + 6 * t) / dt;
    const dh2 = (3 * t ** 2 - 4 * t + 1) / dt;
    const dh3 = (3 * t ** 2 - 2 * t) / dt;

    const interp = (p0, p1, v0, v1) => {
        return h0 * p0 + h1 * p1 + dt * (h2 * v0 + h3 * v1);
    }

    const dinterp = (p0, p1, v0, v1) => {
        return dh0 * p0 + dh1 * p1 + dt * (dh2 * v0 + dh3 * v1);
    }

    const x = interp(p0.x, p1.x, v0.x, v1.x);
    const y = interp(p0.y, p1.y, v0.y, v1.y);
    const z = interp(p0.z, p1.z, v0.z, v1.z);

    const vx = dinterp(p0.x, p1.x, v0.x, v1.x);
    const vy = dinterp(p0.y, p1.y, v0.y, v1.y);
    const vz = dinterp(p0.z, p1.z, v0.z, v1.z);

    return [new THREE.Vector3(x, y, z), new THREE.Vector3(vx, vy, vz)];
}

export function lerp(a, b, t) {
    return a * (1.0 - t) + (b * t);
}