import * as THREE from 'three';
import { createRenderer, createBloomComposer } from "@/core/renderer";
import Earth from '@/objects/Earth';
import StarField from '@/objects/StarField';
import Sun from '@/objects/Sun';
import Camera from '@/core/Camera';
import Controls from '@/core/Controls';
import { distance2D, hermiteInterpolationVec } from "@/util/mathUtil";
import { utcToJulianDate, jdUtcToJdTDB } from "@/util/timeUtil";

export default class App {

    constructor() {
        this.raycaster = new THREE.Raycaster();
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        window.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('keydown', this.onKeyDown);

        this.downloadSolarSystemData();

        this.scene = new THREE.Scene();

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.01); //default: 0.01
        this.scene.add(ambientLight);

        //EARTH
        const realRotationSpeed = 2 * Math.PI / 86164.09; //once in a sidereal day
        this.earth = new Earth(6371, 23.44, realRotationSpeed * 2000); //2000 times real speed for now
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
        this.controls = new Controls(this.camera, this.renderer, this.earth.getPositionGameUnit()); //TODO: move controls to camera

        this.playbackSpeed = 2000;
    }

    start() {
        this.setTime(Date.now());
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

    animate() {
        //Using fixed start time to calculate sim time so it doesn't drift from real time
        const realElapsedMs = performance.now() - this.realStartTimeMs; //How much real time since last time skip

        let delta = realElapsedMs - this.lastRealElapsedMs;
        this.lastRealElapsedMs = realElapsedMs;
        delta /= 1000;

        this.simTimeMs = this.simStartTimeMs + realElapsedMs * this.playbackSpeed;

        this.earth.update(delta);
        this.earth.sunDirectionUniform.copy(this.sun.getObject3D().position).sub(this.earth.getObject3D().position).normalize();
        this.starField.setPositionVec(this.camera.getPosition());

        if (this.ephemeris.done) {
            const jdUTC = utcToJulianDate(new Date(this.simTimeMs));
            const bracket = findEphemerisBracket(jdUTC, this.ephemeris.earth.ephemeris.data);
            const interpolated = hermiteInterpolationVec(bracket);

            const cameraOffset = this.camera.getPosition().clone().sub(this.earth.getPosition());

            this.earth.setPositionVec(interpolated[0]);

            this.camera.setPositionVec(this.earth.getPosition().clone().add(cameraOffset));
            this.controls.setTargetVec(this.earth.getPosition());

            //this.setCameraUpToEarthUp(); //TODO: Needs to set camera up when time skipping, but can't do it in a loop, since it resets controls and drag.
        }


        this.count += delta;
        if (this.count >= 1) { //Updates every second
            this.count = 0;
        }

        this.controls.update();

        this.bloomComposer.render();
    }

    setTime(timeMs) {
        this.realStartTimeMs = performance.now(); //This is just counting up ms from the program launch, accurate for delta
        this.simStartTimeMs = timeMs; //This is actual datetime ms
        this.simTimeMs = timeMs;
        this.lastRealElapsedMs = 0;
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
            this.leftClickStartLoc = { x: e.clientX, y: e.clientY };
            this.leftClickPossible = true; //Only accept it as a click, if release happens within half a second
            this.leftClickTimeout = window.setTimeout(() => { this.leftClickPossible = false; }, 500);
        } else if (e.button == 2) {
            this.rightClickStartLoc = { x: e.clientX, y: e.clientY };
        }
    }

    onPointerUp(e) {
        if (e.button == 0) {
            window.clearTimeout(this.leftClickTimeout);
            const currentLoc = { x: e.clientX, y: e.clientY };
            if (this.leftClickPossible && distance2D(this.leftClickStartLoc, currentLoc) <= 5) {
                const mouse = {};
                //From -1 to 1
                mouse.x = (currentLoc.x / window.innerWidth) * 2 - 1;
                mouse.y = -(currentLoc.y / window.innerHeight) * 2 + 1;

                this.raycaster.setFromCamera(mouse, this.camera.getObject3D());

                let intersects = this.raycaster.intersectObjects(this.scene.children, true);
                //intersects = intersects.filter((o) => o.object.name === "EarthMesh");

                for (let intersection of intersects) {
                    switch (intersection.object.name) {
                        case "EarthMesh":
                            console.log("Intersection with earth:", intersection);

                            this.earth.setSelected(true);
                            this.setCameraUpToEarthUp();
                            return;
                        case "SunMesh":
                            console.log("Intersection with sun:", intersection);
                            return;
                    }

                    this.earth.setSelected(false);
                    this.resetCameraUp();
                }
            }
        } else if (e.button == 2) {
            const currentLoc = { x: e.clientX, y: e.clientY };
            if (distance2D(this.rightClickStartLoc, currentLoc) <= 10) {
                this.earth.setSelected(false);
                this.resetCameraUp();
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
        this.controls.update();

        //Fix touch-action for mobile (OrbitControls turns this to 'auto' when I dispose of the old one, and it breaks the controls)
        this.renderer.domElement.style.touchAction = 'none';
    }

    async downloadSolarSystemData() {
        this.ephemeris = {};
        this.ephemeris.done = false;

        const earthEphemerisPromise = fetch('ephemeris/Earth_ephemeris_1990-01-01_2040-12-31.json');
        const earthOrientationPromise = fetch('ephemeris/Earth_orientation_1990-01-01_2040-12-31.json');
        const sunEphemerisPromise = fetch('ephemeris/Sun_ephemeris_1990-01-01_2040-12-31.json');

        const [earthEphemerisRes, earthOrientationRes, sunEphemerisRes] = await Promise.all([earthEphemerisPromise, earthOrientationPromise, sunEphemerisPromise]);
        const [earthEphemeris, earthOrientation, sunEphemeris] = await Promise.all([earthEphemerisRes.json(), earthOrientationRes.json(), sunEphemerisRes.json()]);

        this.ephemeris.earth = {
            ephemeris: earthEphemeris,
            orientation: earthOrientation
        };

        this.ephemeris.sun = {
            ephemeris: sunEphemeris
        };

        this.ephemeris.done = true;
    }
}

function findEphemerisBracket(jdUTC, data) {
    const jdTDBApprox = jdUtcToJdTDB(jdUTC, data[0].deltaT);

    let low = 0;
    let high = data.length - 1;

    //If outside the data, give the extreme points
    if (jdTDBApprox <= data[0].jdTDB) {
        const start = data[low];
        const end = data[low];
        const jdTDB = jdUtcToJdTDB(jdUTC, start.deltaT);

        return [
            jdTDB,
            start.jdTDB,
            end.jdTDB,
            new THREE.Vector3(start.x, start.z, -start.y),      //pos start
            new THREE.Vector3(end.x, end.z, -end.y),            //pos end
            new THREE.Vector3(start.vx, start.vz, -start.vy),   //vel start
            new THREE.Vector3(end.vx, end.vz, -end.vy)          //vel end
        ];
    } else if (jdTDBApprox >= data[high].jdTDB) {
        const start = data[high];
        const end = data[high];
        const jdTDB = jdUtcToJdTDB(jdUTC, start.deltaT);

        return [
            jdTDB,
            start.jdTDB,
            end.jdTDB,
            new THREE.Vector3(start.x, start.z, -start.y),      //pos start
            new THREE.Vector3(end.x, end.z, -end.y),            //pos end
            new THREE.Vector3(start.vx, start.vz, -start.vy),   //vel start
            new THREE.Vector3(end.vx, end.vz, -end.vy),         //vel end
            true
        ];
    }

    //Binary search
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (data[mid].jdTDB < jdTDBApprox) { //Too low
            low = mid + 1;
        } else { //Too high
            high = mid - 1;
        }
    }

    //Low is higher than high, we have a result
    const start = data[high];
    const end = data[low];
    const jdTDB = jdUtcToJdTDB(jdUTC, start.deltaT);

    //Swap y and z (needs to negate resulting z)
    return [
        jdTDB,
        start.jdTDB,
        end.jdTDB,
        new THREE.Vector3(start.x, start.z, -start.y),      //pos start
        new THREE.Vector3(end.x, end.z, -end.y),            //pos end
        new THREE.Vector3(start.vx, start.vz, -start.vy),   //vel start
        new THREE.Vector3(end.vx, end.vz, -end.vy)          //vel end
    ];
}