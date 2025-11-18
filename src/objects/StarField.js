import * as THREE from 'three';
import { kmToGameUnit, gameUnitToKm3D, kmToGameUnit3D } from '@/util/gameUtil';

export default class StarField {
    constructor() {
        const starsTexture = new THREE.TextureLoader().load("images/8k_stars.jpg");
        const starMat = new THREE.MeshBasicMaterial({
            map: starsTexture,
            side: THREE.BackSide,   //render inside of sphere
            transparent: true,
            opacity: 0.2,
            depthWrite: false
        });
        this.starField = new THREE.Mesh(new THREE.SphereGeometry(150000000, 64, 64), starMat); //Radius big enough, that nothing goes beyond it.
    }

    getPosition() {
        return gameUnitToKm3D(this.starField.position);
    }

    getPositionGameUnit() {
        return this.starField.position;
    }

    setPosition(xKm, yKm, zKm) {
        this.starField.position.set(kmToGameUnit(xKm), kmToGameUnit(yKm), kmToGameUnit(zKm));
    }

    setPositionVec(vectorKm) {
        this.starField.position.copy(kmToGameUnit3D(vectorKm));
    }

    getObject3D() {
        return this.starField;
    }
}