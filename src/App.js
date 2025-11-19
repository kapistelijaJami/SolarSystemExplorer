import * as THREE from 'three';
import { createRenderer, createBloomComposer } from "@/core/renderer";
import Earth from '@/objects/Earth';
import StarField from '@/objects/StarField';
import Sun from '@/objects/Sun';
import Camera from '@/core/Camera';
import Controls from '@/core/Controls';
import { distance2D } from "@/util/mathUtil";

export default class App {

    constructor() {
        this.raycaster = new THREE.Raycaster();
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        window.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('keydown', this.onKeyDown);


        this.scene = new THREE.Scene();

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.01); //default: 0.01
        this.scene.add(ambientLight);

        //EARTH
        this.earth = new Earth(6371, 23.4, 0.144); //Quite fast rotation: 0.144, actual speed: 2 * Math.PI / 86164.09 (once in a sidereal day)
        this.earth.setPosition(150000000, 0, 0);
        this.scene.add(this.earth.getObject3D());

        //CAMERA
        this.camera = new Camera(50, this.earth.getPosition().x - 20000, 0, 0);
        this.scene.add(this.camera.getObject3D());

        //RENDERING
        this.renderer = createRenderer();

        //BLOOM
        this.bloomComposer = createBloomComposer(this.renderer, this.scene, this.camera.getObject3D());

        //STARS
        this.starField = new StarField();
        this.starField.setPositionVec(this.camera.getPosition());
        this.scene.add(this.starField.getObject3D());

        //SUN
        this.sun = new Sun(696340);
        this.scene.add(this.sun.getObject3D());

        //CONTROLS
        this.controls = new Controls(this.camera, this.renderer, this.earth.getPositionGameUnit());
    }

    start() {
        this.lastTime = 0;
        this.count = 0;
        this.animate = this.animate.bind(this); //Creates a new function with 'this' binded to App
        this.renderer.setAnimationLoop(this.animate);

        window.addEventListener('resize', () => {
            this.camera.getObject3D().aspect = window.innerWidth / window.innerHeight;
            this.camera.getObject3D().updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.bloomComposer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate(time) { //Time keeps increasing (ms)
        const delta = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.earth.update(delta);
        this.starField.setPositionVec(this.camera.getPosition());

        this.count += delta;
        if (this.count >= 1) { //Updates every second
            this.count = 0;
        }

        this.controls.update();

        this.bloomComposer.render();
    }

    darkenNonBloomed(obj) {
        if (obj.isMesh && this.bloomLayer.test(obj.layers) === false) {
            this.materials[obj.uuid] = obj.material;
            obj.material = this.darkMaterial;
        }
    }

    restoreMaterial(obj) {
        if (this.materials[obj.uuid]) {
            obj.material = this.materials[obj.uuid];
            delete this.materials[obj.uuid];
        }
    }

    onPointerDown(e) {
        if (e.button == 0) {
            this.clickStartLoc = { x: e.clientX, y: e.clientY };
        } else if (e.button == 2) {
            this.earth.setSelected(false);
            this.resetCameraUp();
        }
    }

    onPointerUp(e) {
        if (e.button == 0) {
            const currentLoc = { x: e.clientX, y: e.clientY };
            if (distance2D(this.clickStartLoc, currentLoc) <= 5) {
                const mouse = {};
                //From -1 to 1
                mouse.x = (currentLoc.x / window.innerWidth) * 2 - 1;
                mouse.y = -(currentLoc.y / window.innerHeight) * 2 + 1;

                this.raycaster.setFromCamera(mouse, this.camera.getObject3D());

                let intersects = this.raycaster.intersectObjects(this.scene.children, true);
                intersects = intersects.filter((o) => o.object.name === "EarthMesh");

                if (intersects.length > 0) {
                    const intersection = intersects[0];
                    console.log("Intersection with earth:", intersection);

                    this.earth.setSelected(true);
                    this.setCameraUpToEarthUp();
                } else {
                    this.earth.setSelected(false);
                    this.resetCameraUp();
                }
            }
        }
    }

    onKeyDown(e) {
        if (e.repeat) {
            return;
        }
        if (e.code === 'KeyW') {
            console.log(e);
        }
    }

    setCameraUpToEarthUp() {
        const localUp = new THREE.Vector3(0, 1, 0);
        const quat = this.earth.axialTilt.getWorldQuaternion(new THREE.Quaternion());
        const earthUpWorld = localUp.applyQuaternion(quat);
        this.camera.setUpVector(earthUpWorld); //Rotate camera up to match earth up

        //Must create new OrbitControls, since camera up is baked in on its creation
        this.resetControls();
    }

    resetCameraUp() {
        this.camera.getObject3D().up.copy(new THREE.Vector3(0, 1, 0));
        this.resetControls();
    }

    resetControls() {
        const temp = new Controls(this.camera, this.renderer, this.controls.getTarget());
        this.controls.dispose();
        this.controls = temp;
    }
}