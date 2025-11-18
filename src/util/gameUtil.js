import { UNIT_SCALING_FACTOR } from '@/constants';

export function kmToGameUnit3D(vectorKm) {
    return vectorKm.clone().multiplyScalar(1 / UNIT_SCALING_FACTOR);
}

export function gameUnitToKm3D(vectorGameUnit) {
    return vectorGameUnit.clone().multiplyScalar(UNIT_SCALING_FACTOR);
}

export function kmToGameUnit(km) {
    return km / UNIT_SCALING_FACTOR;
}

export function milesToKm(miles) {
    return miles * 1.609;
}

export function milesToGameUnit(miles) {
    return kmToGameUnit(milesToKm(miles));
}

export function gameUnitToKm(gameUnit) {
    return gameUnit * UNIT_SCALING_FACTOR;
}

//Not sure if this is correct
export function lightIntensityToGameIntensity(intensity) {
    return intensity / (UNIT_SCALING_FACTOR ** 2);
}