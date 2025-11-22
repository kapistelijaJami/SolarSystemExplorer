import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { kmToGameUnit, kmToGameUnit3D } from '@/util/gameUtil';

export default class Controls {
    constructor(camera, renderer, targetPos) {
        this.controls = new OrbitControls(camera.getObject3D(), renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.rotateSpeed = 0.5;
        this.controls.enablePan = false; //Panning off for now
        this.controls.target.copy(targetPos);

        this.userIsControlling = false;
        this.controls.addEventListener('start', () => {
            this.userIsControlling = true;
        });
        this.controls.addEventListener('end', () => {
            this.userIsControlling = false;
        });
    }

    getTarget() {
        return this.controls.target;
    }

    setTarget(xKm, yKm, zKm) {
        this.controls.target.position.set(kmToGameUnit(xKm), kmToGameUnit(yKm), kmToGameUnit(zKm));
    }

    setTargetVec(targetPos) {
        this.controls.target.copy(kmToGameUnit3D(targetPos));
    }

    isUserControlling() {
        return this.userIsControlling;
    }

    dispose() {
        this.controls.dispose();
    }

    update() {
        this.controls.update();
    }

    getObject3D() {
        return this.controls;
    }
}