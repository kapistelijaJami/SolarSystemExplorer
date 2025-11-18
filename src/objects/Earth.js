import * as THREE from 'three';
import { kmToGameUnit, gameUnitToKm3D, kmToGameUnit3D } from '@/util/gameUtil';

export default class Earth {
    constructor(radiusKm, axialTilt, rotationSpeed) { //rotationSpeed in radians per second
        this.group = new THREE.Group(); //The parent of everything. Handles position at least.

        this.selected = false;

        this.rotationSpeed = rotationSpeed;
        this.cloudRotationSpeed = rotationSpeed * 0.08; //Adding to the earth rotation
        this.axialTilt = new THREE.Object3D();
        this.axialTilt.rotation.x = THREE.MathUtils.degToRad(axialTilt);
        this.group.add(this.axialTilt);

        this.earthMesh = createEarthMesh(radiusKm)
        this.axialTilt.add(this.earthMesh);
        this.earthMesh.name = "EarthMesh";

        this.clouds = createEarthClouds(radiusKm);
        this.earthMesh.add(this.clouds); //Moves with the earth (earth is the parent)

        this.axes = new THREE.AxesHelper(kmToGameUnit(10000));
        this.earthMesh.add(this.axes);


        //WIREFRAME (Do lat-long version)
        /*const wireGeo = new THREE.SphereGeometry(kmToGameUnit(6371 + 38.5), 32, 32);
        const wireMat = new THREE.MeshBasicMaterial({
            color: 0x070707,
            transparent: true,
            opacity: 0.3,
            wireframe: true
        });

        this.wireSphere = new THREE.Mesh(wireGeo, wireMat);*/
        //this.earthMesh.add(this.wireSphere);

        this.latLines = createLatitudeLines(kmToGameUnit(6371 + 10), 128, 17, 0x070707);
        this.longLines = createLongitudeLines(kmToGameUnit(6371 + 10), 128, 36, 0x070707);
        this.earthMesh.add(this.latLines);
        this.earthMesh.add(this.longLines);

        this.latLines.visible = false;
        this.longLines.visible = false;


        //ATMOSPHERE (make better first)
        /*const atmosphereGeo = new THREE.SphereGeometry(kilometersToGameUnit(6371 + 50), 128, 128);
        const atmosphereMat = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            side: THREE.BackSide, // render inside out for better edge fade
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.2
        });
        const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
        atmosphere.position.set(kilometersToGameUnit(150000000), kilometersToGameUnit(0), kilometersToGameUnit(0));
        earth.add(atmosphere);*/
    }

    getPosition() {
        return gameUnitToKm3D(this.group.position);
    }

    getPositionGameUnit() {
        return this.group.position;
    }

    setPosition(xKm, yKm, zKm) {
        this.group.position.set(kmToGameUnit(xKm), kmToGameUnit(yKm), kmToGameUnit(zKm));
    }

    setPositionVec(vectorKm) {
        this.group.position.copy(kmToGameUnit3D(vectorKm));
    }

    update(delta) {
        this.earthMesh.rotation.y += this.rotationSpeed * delta;
        this.clouds.rotation.y += this.cloudRotationSpeed * delta;

        if (this.selected) {
            this.latLines.visible = true;
            this.longLines.visible = true;
            this.axes.visible = true;
        } else {
            this.latLines.visible = false;
            this.longLines.visible = false;
            this.axes.visible = false;
        }
    }

    setSelected(bool) {
        this.selected = bool;
    }

    getObject3D() {
        return this.group;
    }
}

function createEarthMesh(radiusKm) {
    const loader = new THREE.TextureLoader();
    const colorMap = loader.load('images/8k_earth_daymap.jpg');
    //const colorMap = loader.load('images/world.200407.3x8192x4096.jpg'); //pretty good too
    //const colorMap = loader.load('images/land_shallow_topo_8192.jpg'); //similiar to the above
    //const normalMap = loader.load('images/8k_earth_normal_map.tif'); //Doesn't work
    const normalMap = loader.load('images/earthNormalMap_8k-tig.png'); //This looks good (probably better than bump map)
    //const bumpMap = loader.load('images/gebco_08_rev_elev_8192x4096.jpg'); //Pretty good

    const earthMaterial = new THREE.MeshStandardMaterial({
        map: colorMap,
        normalMap: normalMap,
        //normalScale: new THREE.Vector2(0.7, 0.7),
        //bumpMap: bumpMap,
        //bumpScale: 2,
        roughness: 1,
        metalness: 0
    });
    return new THREE.Mesh(new THREE.SphereGeometry(kmToGameUnit(radiusKm), 128, 128), earthMaterial);
}

function createEarthClouds(radiusKm) {
    const loader = new THREE.TextureLoader();
    const cloudTexture = loader.load('images/8k_earth_clouds.jpg');
    const cloudMaterial = new THREE.MeshStandardMaterial({
        alphaMap: cloudTexture,
        transparent: true,
        opacity: 1.3,
        depthWrite: false, //Prevents z-fighting so cloud doesn't block planet normals
        //side: THREE.DoubleSide,
    });
    return new THREE.Mesh(new THREE.SphereGeometry(kmToGameUnit(radiusKm + 5), 128, 128), cloudMaterial);
}

function createLatitudeLines(radius = 1, segments = 128, count = 8, color = 0xffffff) {
    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5
    });

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

function createLongitudeLines(radius = 1, latSegments = 64, count = 12, color = 0xffffff) {
    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5
    });

    for (let i = 0; i < count; i++) {
        const phi = (i / count) * Math.PI * 2; // longitude angle
        const pts = [];

        // sweep from south to north pole
        for (let j = 0; j <= latSegments; j++) {
            const t = -Math.PI / 2 + (j / latSegments) * Math.PI; // -pi/2 -> +pi/2
            const x = radius * Math.cos(t) * Math.cos(phi);
            const y = radius * Math.sin(t);
            const z = radius * Math.cos(t) * Math.sin(phi);
            pts.push(new THREE.Vector3(x, y, z));
        }

        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, mat);
        group.add(line);
    }

    return group;
}