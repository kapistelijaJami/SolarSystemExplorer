import * as THREE from 'three';
import { kmToGameUnit, gameUnitToKm3D, kmToGameUnit3D } from '@/util/gameUtil';

export default class Sun {
    constructor(radiusKm) {
        const sunMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 7
        });

        this.sun = new THREE.Mesh(new THREE.SphereGeometry(kmToGameUnit(radiusKm), 64, 64), sunMat);
        this.sun.position.set(0, 0, 0);

        const sunLight = new THREE.PointLight(0xffffff, 80000000, 0, 1.5); //Less than square decay for now, since the distances are big
        this.sun.add(sunLight);
    }

    getPosition() {
        return gameUnitToKm3D(this.sun.position);
    }

    getPositionGameUnit() {
        return this.sun.position;
    }

    setPosition(xKm, yKm, zKm) {
        this.sun.position.set(kmToGameUnit(xKm), kmToGameUnit(yKm), kmToGameUnit(zKm));
    }

    setPositionVec(vectorKm) {
        this.sun.position.copy(kmToGameUnit3D(vectorKm));
    }

    getObject3D() {
        return this.sun;
    }
}