import * as THREE from 'three';
import { createRenderer, createBloomComposer } from "@/core/renderer";
import Earth from '@/objects/Earth';
import StarField from '@/objects/StarField';
import Sun from '@/objects/Sun';
import Camera from '@/core/Camera';
import Controls from '@/core/Controls';
import { distance2D, hermiteInterpolationVec } from "@/util/mathUtil";
import { utcToJulianDate, jdUtcToJdTDB, sliderValueToRealSpeed, playbackSpeedToSliderValue, roundPlaybackSpeed } from "@/util/timeUtil";
import { PLAYBACK_SLIDER_VALUE_MIN, PLAYBACK_SLIDER_VALUE_MAX } from "@/constants";
import { getObject3DUpWorld } from "@/util/gameUtil";

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
        this.earth = new Earth(6371, 23.44, realRotationSpeed);
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


        //UI CONTROLS
        this.setupUIButtons();

        this.setPlaybackSpeed(2000);
        this.paused = false;
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
        const now = performance.now();
        const realDeltaMs = now - this.lastRealTimeMs;
        this.lastRealTimeMs = now;

        let delta = realDeltaMs / 1000;

        if (!this.paused) {
            this.simTimeMs += realDeltaMs * this.playbackSpeed;
        }
        const simTimeDate = new Date(this.simTimeMs);

        document.getElementById("currentSimTime").innerText = simTimeDate.toISOString().replace("T", " ").replace(/\.\d{3}Z/, ' Z');

        this.earth.update(delta, this);
        this.earth.sunDirectionUniform.copy(this.sun.getObject3D().position.sub(this.earth.getObject3D().position).normalize());
        this.starField.setPositionVec(this.camera.getPosition());

        if (this.ephemeris.done) {
            const jdUTC = utcToJulianDate(simTimeDate);
            const bracket = findEphemerisBracket(jdUTC, this.ephemeris.earth.ephemeris.data);
            const interpolated = hermiteInterpolationVec(bracket);

            const cameraOffset = this.camera.getPosition().clone().sub(this.earth.getPosition());

            this.earth.setPositionVec(interpolated[0]);

            this.camera.setPositionVec(this.earth.getPosition().clone().add(cameraOffset));
            this.controls.setTargetVec(this.earth.getPosition());

            if (this.timeSkip && this.earth.selected) {
                this.timeSkip = false;
                this.setCameraUpToEarthUp();
            }
        }


        this.count += delta;
        if (this.count >= 1) { //Updates every second
            if (!this.controls.isUserControlling() && this.earth.selected) {
                this.setCameraUpToEarthUp(); //Updates the camera up when user isn't controlling the camera, since it drifts very slowly
            }
            this.count = 0;
        }

        this.controls.update();

        this.bloomComposer.render();
    }

    getPlaybackSpeed() {
        return this.paused ? 0 : this.playbackSpeed;
    }

    getRealPlaybackSpeed() {
        return this.playbackSpeed;
    }

    setTime(timeMs) {
        this.lastRealTimeMs = performance.now(); //This is just counting up ms from the program launch, accurate for delta
        this.simTimeMs = timeMs; //This is actual datetime ms
        this.timeSkip = true;
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = roundPlaybackSpeed(speed);
        const speedSlider = document.getElementById("playbackSpeed");
        speedSlider.value = playbackSpeedToSliderValue(this.playbackSpeed);
        document.getElementById("playbackSpeedText").innerText = this.playbackSpeed + "x";
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
        console.log("Key code:", `"${e.code}"`, e);

        //Allow repeat:
        if (e.code === 'ArrowLeft') {
            const slider = document.getElementById("playbackSpeed");
            const newValue = Math.max(PLAYBACK_SLIDER_VALUE_MIN, parseInt(slider.value) - 1);
            this.setPlaybackSpeed(sliderValueToRealSpeed(newValue));
        } else if (e.code === 'ArrowRight') {
            const slider = document.getElementById("playbackSpeed");
            const newValue = Math.min(PLAYBACK_SLIDER_VALUE_MAX, parseInt(slider.value) + 1);
            this.setPlaybackSpeed(sliderValueToRealSpeed(newValue));
        }

        if (e.repeat) {
            return;
        }

        //Don't allow repeat:
        if (e.code === 'KeyW') {
            //TODO: add movement
        } else if (e.code === 'Space') {
            this.togglePause();
        }
    }

    setCameraUpToEarthUp() {
        const earthUpWorld = getObject3DUpWorld(this.earth.axialTilt);
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

    setupUIButtons() {
        const speedSlider = document.getElementById("playbackSpeed");
        speedSlider.value = this.playbackSpeed;
        document.getElementById("playbackSpeedText").innerText = this.playbackSpeed + "x";

        speedSlider.addEventListener("input", (e) => {
            this.setPlaybackSpeed(sliderValueToRealSpeed(speedSlider.value));
        });

        const playToggleBtn = document.getElementById("playToggle");
        this.togglePause = this.togglePause.bind(this);
        playToggleBtn.addEventListener("click", this.togglePause);

        document.getElementById("realTime").addEventListener("click", () => {
            this.setPaused(false);
            this.setPlaybackSpeed(1);
            this.setTime(Date.now());
        });
    }

    setPaused(bool) {
        const playToggleBtn = document.getElementById("playToggle");
        this.paused = bool;
        if (this.paused) {
            playToggleBtn.innerText = "Play";
        } else {
            playToggleBtn.innerText = "Pause";
        }
    }

    togglePause() {
        this.setPaused(!this.paused);
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
        return createEphemerisArray(jdUTC, start, end);
    } else if (jdTDBApprox >= data[high].jdTDB) {
        const start = data[high];
        const end = data[high];
        return createEphemerisArray(jdUTC, start, end);
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
    return createEphemerisArray(jdUTC, start, end);
}

function createEphemerisArray(jdUTC, start, end) {
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