import * as THREE from 'three';
import { kmToGameUnit, gameUnitToKm3D, kmToGameUnit3D } from '@/util/gameUtil';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { Line2 } from 'three/addons/lines/Line2.js';

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


        this.latLines = createLatitudeLines(140000000, 128, 17, 0xffffff);
        this.longLines = createLongitudeLines(140000000, 128, 36, kmToGameUnit(10), 0xffffff);

        this.starField.add(this.latLines);
        this.starField.add(this.longLines);
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

function createLatitudeLines(radius = 1, segments = 128, count = 8, color = 0xffffff) { //TODO: Do the same line types longitude lines will be
    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: false
    });

    const matEquator = new THREE.LineBasicMaterial({
        color: 0xff0000,
        transparent: false
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

//TODO: maybe make an option for hour longitude lines instead of 10 degrees.
function createLongitudeLines(radius = 1, latSegments = 64, count = 12, linewidth = 0.05, color = 0xffffff) {
    const group = new THREE.Group();

    const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: false
    });

    const matGreen = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        transparent: false
    });

    for (let angle = 0; angle < 360; angle += 10) {
        let wider = angle === 0;
        let green = wider;
        wider = false; //all are normal for now

        //const phi = (i / count) * Math.PI * 2; // longitude angle
        const phi = (angle / 360) * Math.PI * 2;
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
            line = new THREE.Line(geo, green ? matGreen : mat);
        }

        group.add(line);
    }

    return group;
}