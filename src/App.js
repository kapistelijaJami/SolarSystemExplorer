import * as THREE from 'three';
import { createRenderer, createBloomComposer } from "@/core/renderer";
import Earth from '@/objects/Earth';
import StarField from '@/objects/StarField';
import Sun from '@/objects/Sun';
import Moon from '@/objects/Moon';
import Camera from '@/core/Camera';
import Controls from '@/core/Controls';
import * as mathUtil from "@/util/mathUtil";
import * as timeUtil from "@/util/timeUtil";
import { PLAYBACK_SLIDER_VALUE_MIN, PLAYBACK_SLIDER_VALUE_MAX } from "@/constants";
import * as gameUtil from "@/util/gameUtil";

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

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.02); //default: 0.01
        this.scene.add(ambientLight);

        //EARTH
        this.earth = new Earth(6371);
        this.earth.setPosition(150000000, 0, 0);
        this.scene.add(this.earth.getObject3D());

        //SUN
        this.sun = new Sun(696340);
        this.scene.add(this.sun.getObject3D());

        //MOON
        this.moon = new Moon(1737.4);
        this.scene.add(this.moon.getObject3D());

        //CAMERA
        //for sun: this.sun.getPosition().x - 50000000, earth: this.earth.getPosition().x - 20000, moon this.moon.getPosition().x - 8000
        this.camera = new Camera(50, this.moon.getPosition().x - 8000, 0, 0); //fov def: 50
        this.scene.add(this.camera.getObject3D());

        //RENDERING
        this.renderer = createRenderer();

        //BLOOM
        this.bloomComposer = createBloomComposer(this.renderer, this.scene, this.camera.getObject3D());

        //STARS
        this.starField = new StarField();
        this.starField.setPositionVec(this.camera.getPosition());
        this.scene.add(this.starField.getObject3D());

        //CONTROLS
        this.controls = new Controls(this.camera, this.renderer, this.earth.getPositionGameUnit()); //TODO: move controls to camera


        //UI CONTROLS
        this.setupUIButtons();

        this.setTargetBody(this.moon);
        this.moon.selected = false;
        this.setPlaybackSpeed(1);
        this.paused = false;
    }

    start() {
        //this.setTime(Date.now());
        this.setTime(new Date("2000-01-01T12:00:00Z").getTime());
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

        document.getElementById("currentSimTime").innerText = simTimeDate.toISOString().replace("T", " ").replace(/\.\d{3}Z/, ' UTC');

        this.earth.update(delta, this);
        this.moon.update(delta, this);
        this.starField.setPositionVec(this.camera.getPosition());

        if (this.ephemeris.done) {
            const jdUTC = timeUtil.utcToJulianDate(simTimeDate);

            let cameraOffset;
            if (this.targetedBody) {
                cameraOffset = this.camera.getPosition().clone().sub(this.targetedBody.getPosition()); //Camera offset before we update location, so we can keep the same offset
            }

            this.earth.setStateFromEphemeris(jdUTC, this.ephemeris.earth);
            this.moon.setStateFromEphemeris(jdUTC, this.ephemeris.moon);
            this.sun.setStateFromEphemeris(jdUTC, this.ephemeris.sun);

            if (this.targetedBody) {
                this.camera.setPositionVec(this.targetedBody.getPosition().clone().add(cameraOffset));

                //Moon view from earth (needs to target the moon):
                //this.camera.setPositionVec(this.earth.getPosition().clone().add(this.moon.getPosition().clone().sub(this.earth.getPosition()).multiplyScalar(0.985)));

                this.controls.setTargetVec(this.targetedBody.getPosition());
            }

            if (this.timeSkip) {
                this.timeSkip = false;
                if (this.targetedBody && this.targetedBody.selected) {
                    this.setCameraUpToBodyUp(this.targetedBody);
                }
            }
        }


        this.count += delta;
        if (this.count >= 1) { //Updates every second
            if (!this.controls.isUserControlling() && this.targetedBody && this.targetedBody.selected) {
                this.setCameraUpToBodyUp(this.targetedBody); //Updates the camera up when user isn't controlling the camera, since it drifts very slowly
            }
            this.count = 0;
        }

        this.controls.update();

        this.bloomComposer.render();
    }

    /**
     * Gets playbackSpeed, but returns 0 if paused.
     * @returns 
     */
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
        this.playbackSpeed = timeUtil.roundPlaybackSpeed(speed);
        const speedSlider = document.getElementById("playbackSpeed");
        speedSlider.value = timeUtil.playbackSpeedToSliderValue(this.playbackSpeed);
        document.getElementById("playbackSpeedText").innerText = this.playbackSpeed + "x (" + timeUtil.playbackSpeedToTimePerSec(this.playbackSpeed) + ")";
    }

    focusTarget() {
        if (!this.targetedBody) {
            return;
        }

        const dirToTarget = gameUtil.direction(this.camera.getPosition(), this.targetedBody.getPosition());

        this.camera.setPositionVec(this.targetedBody.getPosition().clone().sub(dirToTarget.multiplyScalar(this.targetedBody.radiusKm * 4)));
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
            if (this.leftClickPossible && mathUtil.distance2D(this.leftClickStartLoc, currentLoc) <= 10) {
                const mouse = {};
                //From -1 to 1
                mouse.x = (currentLoc.x / window.innerWidth) * 2 - 1;
                mouse.y = -(currentLoc.y / window.innerHeight) * 2 + 1;

                this.raycaster.setFromCamera(mouse, this.camera.getObject3D());

                let intersects = this.raycaster.intersectObjects(this.scene.children, true);

                for (let intersection of intersects) {
                    switch (intersection.object.name) {
                        case "EarthMesh":
                            console.log("Intersection with earth:", intersection);

                            this.setTargetBody(this.earth);
                            return;
                        case "SunMesh":
                            console.log("Intersection with sun:", intersection);

                            this.setTargetBody(this.sun);
                            return;
                        case "MoonMesh":
                            console.log("Intersection with moon:", intersection);

                            this.setTargetBody(this.moon);
                            return;
                    }

                    this.earth.setSelected(false);
                    this.moon.setSelected(false);
                    this.sun.setSelected(false);
                    this.resetCameraUp();
                }
            }
        } else if (e.button == 2) {
            const currentLoc = { x: e.clientX, y: e.clientY };
            if (mathUtil.distance2D(this.rightClickStartLoc, currentLoc) <= 10) {
                this.earth.setSelected(false);
                this.moon.setSelected(false);
                this.sun.setSelected(false);
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
            this.setPlaybackSpeed(timeUtil.sliderValueToRealSpeed(newValue));
        } else if (e.code === 'ArrowRight') {
            const slider = document.getElementById("playbackSpeed");
            const newValue = Math.min(PLAYBACK_SLIDER_VALUE_MAX, parseInt(slider.value) + 1);
            this.setPlaybackSpeed(timeUtil.sliderValueToRealSpeed(newValue));
        }

        if (e.repeat) {
            return;
        }

        //Don't allow repeat:
        if (e.code === 'KeyW') {
            //TODO: add movement
        } else if (e.code === 'Space') {
            this.togglePause();
        } else if (e.code === 'KeyF') {
            this.focusTarget();
        }
    }

    setTargetBody(body) {
        this.controls.setTargetVec(body.getPosition());
        this.targetedBody = body;
        body.setSelected(true);
        this.setCameraUpToBodyUp(body);
    }

    setCameraUpToBodyUp(body) {
        const bodyUpWorld = gameUtil.getObject3DUpWorld(body.axialTilt);
        this.camera.setUpVector(bodyUpWorld); //Rotate camera up to match earth up

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

        const earthPositionPromise = fetch('ephemeris/Earth_ephemeris_1990-01-01_2040-12-31.json');
        //const earthOrientationPromise = fetch('ephemeris/Earth_orientation_1990-01-01_2040-12-31.json');
        const earthOrientationPromise = fetch('ephemeris/Earth_SPICE_orientation_1990-01-01_2040-12-31.json');
        const moonPositionPromise = fetch('ephemeris/Moon_ephemeris_1990-01-01_2040-12-31.json');
        const moonOrientationPromise = fetch('ephemeris/Moon_SPICE_orientation_1990-01-01_2040-12-31.json');
        const sunPositionPromise = fetch('ephemeris/Sun_ephemeris_1990-01-01_2040-12-31.json');

        const [earthPositionRes, earthOrientationRes, moonPositionRes, moonOrientationRes, sunPositionRes] = await Promise.all([
            earthPositionPromise,
            earthOrientationPromise,
            moonPositionPromise,
            moonOrientationPromise,
            sunPositionPromise
        ]);
        const [earthPosition, earthOrientation, moonPosition, moonOrientation, sunPosition] = await Promise.all([
            earthPositionRes.json(),
            earthOrientationRes.json(),
            moonPositionRes.json(),
            moonOrientationRes.json(),
            sunPositionRes.json()
        ]);

        this.ephemeris.earth = {
            position: earthPosition,
            orientation: earthOrientation
        };

        this.ephemeris.moon = {
            position: moonPosition,
            orientation: moonOrientation
        };

        this.ephemeris.sun = {
            position: sunPosition
        };

        this.ephemeris.done = true;
    }

    setupUIButtons() {
        const speedSlider = document.getElementById("playbackSpeed");
        speedSlider.value = this.playbackSpeed;
        document.getElementById("playbackSpeedText").innerText = this.playbackSpeed + "x";

        speedSlider.addEventListener("input", (e) => {
            this.setPlaybackSpeed(timeUtil.sliderValueToRealSpeed(speedSlider.value));
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