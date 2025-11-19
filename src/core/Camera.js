import * as THREE from 'three';
import { kmToGameUnit, gameUnitToKm3D, kmToGameUnit3D } from '@/util/gameUtil';

export default class Camera {
    constructor(fov, xKm, yKm, zKm) {
        this.camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 1e9);

        this.setPosition(xKm, yKm, zKm);
    }

    getPosition() {
        return gameUnitToKm3D(this.camera.position);
    }

    getPositionGameUnit() {
        return this.camera.position;
    }

    setPosition(xKm, yKm, zKm) {
        this.camera.position.set(kmToGameUnit(xKm), kmToGameUnit(yKm), kmToGameUnit(zKm));
    }

    setPositionVec(vectorKm) {
        this.camera.position.copy(kmToGameUnit3D(vectorKm));
    }

    setUpVector(upWorld) {
        this.camera.up.copy(upWorld);
    }

    getObject3D() {
        return this.camera;
    }
}