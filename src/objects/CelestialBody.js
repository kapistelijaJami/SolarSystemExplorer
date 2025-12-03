import * as THREE from 'three';
import * as gameUtil from '@/util/gameUtil';
import * as ephemerisUtil from '@/util/ephemerisUtil';
import * as mathUtil from "@/util/mathUtil";
import * as timeUtil from "@/util/timeUtil";
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

export default class CelestialBody {
    constructor(radiusKm) {
        this.group = new THREE.Group(); //The parent of everything. Handles position.
        this.radiusKm = radiusKm;
        this.selected = false;

        this.axialTilt = new THREE.Object3D();
        this.group.add(this.axialTilt);

        this.mesh = this.createMesh();
        this.axialTilt.add(this.mesh);

        this.axes = new THREE.AxesHelper(gameUtil.kmToGameUnit(radiusKm * 2));
        this.mesh.add(this.axes);

        this.axesGlobal = new THREE.AxesHelper(gameUtil.kmToGameUnit(radiusKm * 4));
        this.group.add(this.axesGlobal);
    }

    getMaterialProperties() {
        return {
            roughness: 1,
            metalness: 0
        };
    }

    createMesh() {
        const props = this.getMaterialProperties();

        const loader = new THREE.TextureLoader();
        if (props.texturePath) {
            props.map = loader.load(props.texturePath);
        }
        if (props.normalMapPath) {
            props.normalMap = loader.load(props.normalMapPath);
        }
        if (props.bumpMapPath) {
            props.bumpMap = loader.load(props.bumpMapPath);
        }
        if (props.displacementMapPath) {
            props.displacementMap = loader.load(props.displacementMapPath);
        }

        const material = new THREE.MeshStandardMaterial(props);

        return new THREE.Mesh(new THREE.SphereGeometry(gameUtil.kmToGameUnit(this.radiusKm), 128, 128), material);
    }

    getPosition() {
        return gameUtil.gameUnitToKm3D(this.group.position);
    }

    getPositionGameUnit() {
        return this.group.position;
    }

    setPosition(xKm, yKm, zKm) {
        this.group.position.set(gameUtil.kmToGameUnit(xKm), gameUtil.kmToGameUnit(yKm), gameUtil.kmToGameUnit(zKm));
    }

    setPositionVec(vectorKm) {
        this.group.position.copy(gameUtil.kmToGameUnit3D(vectorKm));
    }

    //W is just rotation around UP axis
    setRotationW(wRad) {
        this.mesh.rotation.y = wRad;
    }

    setOrientation(orientationVec) {
        gameUtil.pointObject3DUpToVector(this.axialTilt, orientationVec);
    }

    setSelected(bool) {
        this.selected = bool;
    }

    getObject3D() {
        return this.group;
    }

    toggleGlobalAxes() {
        this.axesGlobal.visible = !this.axesGlobal.visible;
    }

    setStateFromEphemeris(jdUTC, ephemerisData) {
        if (ephemerisData.position) {
            const [sEph, eEph] = ephemerisUtil.findEphemerisBracket(jdUTC, ephemerisData.position.data);
            const ephemeris = ephemerisUtil.createEphemerisArray(jdUTC, sEph, eEph);
            const interpolatedLoc = mathUtil.hermiteInterpolationVec(ephemeris);

            this.setPositionVec(interpolatedLoc[0]);
        }

        if (ephemerisData.orientation) {
            const [sOr, eOr] = ephemerisUtil.findEphemerisBracket(jdUTC, ephemerisData.orientation.data);
            const orientation = ephemerisUtil.createOrientationArray(jdUTC, sOr, eOr);
            const normalizedTime = timeUtil.normalizeTime(orientation[0], orientation[1], orientation[2]);
            const interpolatedRot = mathUtil.lerp(orientation[3], orientation[4], normalizedTime);
            //TODO: +90 degrees works for earth, but not for moon, moon seems to be close to 0
            this.setRotationW(mathUtil.degreesToRadians(interpolatedRot) /*+ Math.PI / 2*/); //I think rotating extra 90 degrees makes it correct
            //TODO: create function to convert W to correct angle for prime meridian.

            const interpolatedOrientation = mathUtil.lerpVec(orientation[5], orientation[6], normalizedTime);
            this.setOrientation(interpolatedOrientation);
        }
    }
}

//TODO: Combine these with StarField one, and move to utils
export function createLatitudeLines(radius = 1, segments = 128, count = 8, color = 0xffffff) { //TODO: Do the same line types longitude lines will be
    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5
    });
    mat.depthWrite = false;
    mat.depthTest = true;

    const matEquator = new THREE.LineBasicMaterial({
        color: 0x990000,
        transparent: true,
        opacity: 0.8
    });

    for (let i = 1; i <= count; i++) {
        // latitude angle from -PI/2 -> +PI/2, skip poles
        let equator = (i == Math.floor(count / 2) + 1);
        const theta = (i / (count + 1)) * Math.PI - Math.PI / 2;
        const r = radius * Math.cos(theta);
        const y = radius * Math.sin(theta);

        // build circle points in XZ plane
        const pts = [];
        for (let s = 0; s < segments; s++) {
            const a = (s / segments) * Math.PI * 2;
            pts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
        }

        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        // setFromPoints gives a non-indexed position buffer. LineLoop expects the loop to close automatically.
        const loop = new THREE.LineLoop(geo, equator ? matEquator : mat);
        group.add(loop);
    }

    return group;
}

export function createLongitudeLines(radius = 1, latSegments = 64, count = 12, linewidth = 0.05, color = 0xffffff) {
    const group = new THREE.Group();

    const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5
    });
    const matGreen = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5
    });

    const matWider = new LineMaterial({
        color: 0x000000,
        linewidth: gameUtil.kmToGameUnit(15),
        transparent: true,
        opacity: 0.6,
        worldUnits: true
    });

    for (let angle = 0; angle < 360; angle += 10) {
        let wider = angle === 0;
        let pm = angle === 0;
        wider = false; //all are normal for now

        const phi = (angle / 360) * Math.PI * 2; //Longitude angle
        const pts = [];
        const ptsWide = [];

        // sweep from south to north pole
        for (let j = 0; j <= latSegments; j++) {
            const t = -Math.PI / 2 + (j / latSegments) * Math.PI; // -pi/2 -> +pi/2
            const x = radius * Math.cos(t) * Math.cos(phi);
            const y = radius * Math.sin(t);
            const z = radius * Math.cos(t) * Math.sin(phi);
            if (wider) {
                ptsWide.push(x);
                ptsWide.push(y);
                ptsWide.push(z);
            } else {
                pts.push(new THREE.Vector3(x, y, z));
            }
        }

        let line;
        if (wider) { //TODO: Make a version where it doesn't overlap on itself
            const geometry = new LineGeometry();
            geometry.setPositions(ptsWide);

            line = new Line2(geometry, matWider);
            line.computeLineDistances();
        } else { //Normal line //TODO: Make a version with world units so thickness scales with how close camera is
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            line = new THREE.Line(geo, pm ? matGreen : mat);
        }

        group.add(line);
    }

    return group;
}