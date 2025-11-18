import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default class Controls {
    constructor(camera, renderer, targetPos) {
        this.controls = new OrbitControls(camera.getObject3D(), renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.rotateSpeed = 0.5;
        this.controls.enablePan = false; //Panning off for now
        this.controls.target.copy(targetPos);
    }

    update() {
        this.controls.update();
    }
}