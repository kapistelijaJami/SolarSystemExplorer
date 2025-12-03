import * as THREE from 'three';
import * as gameUtil from '@/util/gameUtil';
import CelestialBody, { createLatitudeLines, createLongitudeLines } from '@/objects/CelestialBody'

export default class Earth extends CelestialBody {
    constructor(radiusKm) {
        super(radiusKm);

        const realRotationSpeed = 2 * Math.PI / 86164.09; //RealRotationSpeed in radians per second
        this.cloudRotationSpeed = realRotationSpeed * 0.08; //Adding to the earth rotation

        this.mesh.name = "EarthMesh";
        this.clouds = this.createEarthClouds();
        this.mesh.add(this.clouds); //Moves with the earth (earth is the parent)*/

        this.sunDirectionVector = new THREE.Vector3(-1, 0, 0); //Placeholder, updated in update()
        this.sunDirectionLine = gameUtil.createLine(0xffff00);
        this.group.add(this.sunDirectionLine);

        this.latLines = createLatitudeLines(gameUtil.kmToGameUnit(radiusKm + 10), 128, 17, 0x070707);
        this.longLines = createLongitudeLines(gameUtil.kmToGameUnit(radiusKm + 10), 128, 36, gameUtil.kmToGameUnit(10), 0x070707);
        this.mesh.add(this.latLines);
        this.mesh.add(this.longLines);

        this.latLines.visible = false;
        this.longLines.visible = false;

        //Helps when both are transparent
        /*this.clouds.renderOrder = 0; //Render clouds first
        this.longLines.renderOrder = 1;*/

        //ATMOSPHERE
        this.atmosphere = this.createAtmosphere();
        this.mesh.add(this.atmosphere);
    }

    getMaterialProperties() {
        return {
            texturePath: 'images/8k_earth_daymap.jpg',
            normalMapPath: 'images/earthNormalMap_8k-tig.png',
            //normalScale: new THREE.Vector2(0.7, 0.7),
            //bumpMap: bumpMap,
            //bumpScale: 2,
            roughness: 1,
            metalness: 0,
            //transparent: true,
            //opacity: 1
        };
    }

    update(delta, app) {
        /*this.mesh.rotation.y += this.rotationSpeed * delta * app.getPlaybackSpeed();*/
        this.clouds.rotation.y += this.cloudRotationSpeed * delta * app.getPlaybackSpeed();

        this.sunDirectionVector.copy(app.sun.getObject3D().position.clone().sub(this.group.position).normalize());
        const lineEnd = this.sunDirectionVector.clone().multiplyScalar(gameUtil.kmToGameUnit(this.radiusKm * 5));
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

    setRotationW(wRad) {
        super.setRotationW(wRad + Math.PI / 2); //I still don't know why earth gets the extra 90 degrees.
    }

    createEarthClouds() {
        const loader = new THREE.TextureLoader();
        const cloudTexture = loader.load('images/8k_earth_clouds.jpg');
        const cloudMaterial = new THREE.MeshStandardMaterial({
            alphaMap: cloudTexture,
            transparent: true,
            //opacity: 1.3,
            //depthWrite: false, //Prevents z-fighting so cloud doesn't block planet normals
            //side: THREE.DoubleSide,
        });
        return new THREE.Mesh(new THREE.SphereGeometry(gameUtil.kmToGameUnit(this.radiusKm + 5), 128, 128), cloudMaterial);
    }

    createAtmosphere() {
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

        const atmosphereGeometry = new THREE.SphereGeometry(gameUtil.kmToGameUnit(this.radiusKm + 250), 128, 128);

        const atmosphereMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                sunDirection: { value: this.sunDirectionVector },
                atmosphereColor: { value: new THREE.Color(0.3, 0.6, 1.0) },
                coef: { value: 100.0 },
                power: { value: 5.0 },
                atmosphereCutoffDist: { value: gameUtil.kmToGameUnit(200000) } //200000.0 seems to fix the problem for now
            },
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });

        return new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    }
}

/*function createEarthMesh(radiusKm) {
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
    return new THREE.Mesh(new THREE.SphereGeometry(gameUtil.kmToGameUnit(radiusKm), 128, 128), earthMaterial);
}*/