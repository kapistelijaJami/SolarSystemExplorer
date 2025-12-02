import * as THREE from 'three';
import { kmToGameUnit, gameUnitToKm3D, kmToGameUnit3D, pointObject3DUpToVector } from '@/util/gameUtil';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

export default class Earth {
    constructor(radiusKm, axialTilt, rotationSpeed) { //rotationSpeed in radians per second
        this.group = new THREE.Group(); //The parent of everything. Handles position at least.

        this.selected = false;

        this.rotationSpeed = rotationSpeed;
        this.cloudRotationSpeed = rotationSpeed * 0.08; //Adding to the earth rotation
        this.axialTilt = new THREE.Object3D();
        pointObject3DUpToVector(this.axialTilt, new THREE.Vector3(0.0028185262282861166, 0.9174740972578344, -0.3977855411786888)); //Just one orientation of the earth
        this.group.add(this.axialTilt);

        this.earthMesh = createEarthMesh(radiusKm)
        this.axialTilt.add(this.earthMesh);
        this.earthMesh.name = "EarthMesh";

        this.clouds = createEarthClouds(radiusKm);
        this.earthMesh.add(this.clouds); //Moves with the earth (earth is the parent)

        this.axes = new THREE.AxesHelper(kmToGameUnit(10000));
        this.earthMesh.add(this.axes);

        this.axesGlobal = new THREE.AxesHelper(kmToGameUnit(20000));
        this.group.add(this.axesGlobal);

        this.sunDirectionVector = new THREE.Vector3(-1, 0, 0); //Placeholder, updated in update()
        this.sunDirectionLine = createSunDirectionLine();
        this.group.add(this.sunDirectionLine);

        this.latLines = createLatitudeLines(kmToGameUnit(6371 + 10), 128, 17, 0x070707);
        this.longLines = createLongitudeLines(kmToGameUnit(6371 + 10), 128, 36, kmToGameUnit(10), 0x070707);
        this.earthMesh.add(this.latLines);
        this.earthMesh.add(this.longLines);

        this.latLines.visible = false;
        this.longLines.visible = false;


        //Helps when both are transparent
        /*this.clouds.renderOrder = 0; //Render clouds first
        this.longLines.renderOrder = 1;*/


        //ATMOSPHERE (make better first)
        this.atmosphere = createAtmosphere(this, radiusKm);
        this.earthMesh.add(this.atmosphere);
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

    update(delta, app) {
        /*this.earthMesh.rotation.y += this.rotationSpeed * delta * app.getPlaybackSpeed();*/
        this.clouds.rotation.y += this.cloudRotationSpeed * delta * app.getPlaybackSpeed();

        this.sunDirectionVector.copy(app.sun.getObject3D().position.sub(this.group.position).normalize());
        const lineEnd = this.sunDirectionVector.clone().multiplyScalar(kmToGameUnit(30000));
        this.sunDirectionLine.geometry.attributes.position.setXYZ(1, lineEnd.x, lineEnd.y, lineEnd.z);
        this.sunDirectionLine.geometry.attributes.position.needsUpdate = true;

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

    //W is just rotation around UP axis
    setRotationW(w_rad) {
        this.earthMesh.rotation.y = w_rad;
    }

    setOrientation(orientationVec) {
        pointObject3DUpToVector(this.axialTilt, orientationVec);
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
        metalness: 0,
        //transparent: true,
        //opacity: 1
    });
    //earthMaterial.normalScale = new THREE.Vector2(0.0, 0.0);
    return new THREE.Mesh(new THREE.SphereGeometry(kmToGameUnit(radiusKm), 128, 128), earthMaterial);
}

function createEarthClouds(radiusKm) {
    const loader = new THREE.TextureLoader();
    const cloudTexture = loader.load('images/8k_earth_clouds.jpg');
    const cloudMaterial = new THREE.MeshStandardMaterial({
        alphaMap: cloudTexture,
        transparent: true,
        //opacity: 1.3,
        //depthWrite: false, //Prevents z-fighting so cloud doesn't block planet normals
        //side: THREE.DoubleSide,
    });
    return new THREE.Mesh(new THREE.SphereGeometry(kmToGameUnit(radiusKm + 5), 128, 128), cloudMaterial);
}

function createLatitudeLines(radius = 1, segments = 128, count = 8, color = 0xffffff) { //TODO: Do the same line types longitude lines will be
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

function createLongitudeLines(radius = 1, latSegments = 64, count = 12, linewidth = 0.05, color = 0xffffff) {
    const group = new THREE.Group();

    const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5
    });

    const matWider = new LineMaterial({
        color: 0x000000,
        linewidth: kmToGameUnit(15),
        transparent: true,
        opacity: 0.6,
        worldUnits: true
    });

    for (let angle = 0; angle < 360; angle += 10) {
        let wider = angle === 0;
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
            line = new THREE.Line(geo, mat);
        }

        group.add(line);
    }

    return group;
}

function createAtmosphere(earth, radiusKm) { //TODO: This looks weird from far away (looks like it goes fully in front of the earth looking from specific angles)
    const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPositionWorld;

    void main() {
        // Get the normal in World Space (not View Space)
        // This helps us compare it to the Sun's fixed world position
        vNormal = normalize(mat3(modelMatrix) * normal);

        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vPositionWorld = worldPosition.xyz;

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
    `;

    const fragmentShader = `
    uniform vec3 sunDirection;
    uniform vec3 atmosphereColor;
    uniform float coef;
    uniform float power;
    uniform float atmosphereCutoffDist;

    varying vec3 vNormal;
    varying vec3 vPositionWorld;

    void main() {
        vec3 viewDirection = normalize(cameraPosition - vPositionWorld);

        float distance = length(cameraPosition - vPositionWorld);
        //Smoothstep going down from 3/4 of atmosphereCutoffDist = 1.0 intensity, to atmosphereCutoffDist = 0.0 intensity
        float distanceIntensity = smoothstep(atmosphereCutoffDist, 3.0/4.0 * atmosphereCutoffDist, distance);

        // Calculate "Edge Proximity"
        // Since we are using BackSide, the dot product is negative.
        // dot = -1.0 (Center of planet / Surface)
        // dot =  0.0 (Edge of atmosphere mesh)
        float viewDot = dot(vNormal, viewDirection);

        // Radial Falloff (The Simplification)
        // We want alpha to be 1.0 at the center (-1.0) and 0.0 at the edge (0.0).
        // So we simply flip the sign of viewDot.
        // pow() makes the falloff non-linear (so it fades out gracefully, not abruptly)
        float atmosphereDensity = pow(-viewDot, power);

        // Sun Mask (Day/Night)
        float sunDot = dot(vNormal, sunDirection);
        float sunIntensity = clamp(smoothstep(-0.4, 0.2, sunDot), 0.06, 1.0);

        // Final Composition
        // We rely on AdditiveBlending to handle the transparency naturally
        gl_FragColor = vec4(atmosphereColor, clamp(atmosphereDensity * sunIntensity * coef * distanceIntensity, 0.0, 1.0));
    }
    `;

    const atmosphereGeometry = new THREE.SphereGeometry(kmToGameUnit(radiusKm + 250), 128, 128);

    const atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
            sunDirection: { value: earth.sunDirectionVector },
            atmosphereColor: { value: new THREE.Color(0.3, 0.6, 1.0) },
            coef: { value: 100.0 },
            power: { value: 5.0 },
            atmosphereCutoffDist: { value: kmToGameUnit(200000) } //200000.0 seems to fix the problem for now
        },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false
    });

    return new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
}

function createSunDirectionLine() {
    const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
    return new THREE.Line(geometry, material);
}