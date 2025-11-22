import * as THREE from 'three';
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

export function pointObject3DUpToVector(object3D, vector) {
    const targetUp = vector.clone().normalize();
    const currentUp = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(currentUp, targetUp);
    object3D.quaternion.copy(quaternion);
}

//Rotates an UP vector by the orientation of the object to get object's up vector.
export function getObject3DUpWorld(object3D) {
    const localUp = new THREE.Vector3(0, 1, 0);
    const objQuat = object3D.getWorldQuaternion(new THREE.Quaternion());
    const objectUpWorld = localUp.applyQuaternion(objQuat);
    return objectUpWorld;
}