import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);


const unitScalingFactor = 1000;

//SUN
const sunPosition = new THREE.Vector3(kilometersToGameUnit(0), kilometersToGameUnit(0), kilometersToGameUnit(0));
const sun = new THREE.Mesh(
    new THREE.SphereGeometry(kilometersToGameUnit(696340), 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
);
sun.position.copy(sunPosition);
scene.add(sun);

//LIGHTS
const sunLight = new THREE.PointLight(0xffffff, 80000000, 0, 1.5); //Less than square decay for now, since the distances are big
sun.add(sunLight);

const ambient = new THREE.AmbientLight(0xffffff, 0.01); //default: 0.02
scene.add(ambient);


//EARTH
const earthPivot = new THREE.Object3D();
earthPivot.rotation.z = THREE.MathUtils.degToRad(23.4);
earthPivot.position.set(kilometersToGameUnit(150000000), 0, 0);
scene.add(earthPivot);

const loader = new THREE.TextureLoader();
const colorMap = loader.load('images/8k_earth_daymap.jpg');
//const colorMap = loader.load('images/world.200407.3x8192x4096.jpg'); //pretty good too
//const colorMap = loader.load('images/land_shallow_topo_8192.jpg'); //similiar to the above
//const normalMap = loader.load('images/8k_earth_normal_map.tif'); //Doesn't work
const normalMap = loader.load('images/earthNormalMap_8k-tig.png'); //This looks good (probably better than bump map)
//const bumpMap = loader.load('images/gebco_08_rev_elev_8192x4096.jpg'); //Pretty good

//Check what these do:
/*colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
normalMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
bumpMap.anisotropy = renderer.capabilities.getMaxAnisotropy();*/

const earthMaterial = new THREE.MeshStandardMaterial({
    map: colorMap,
    normalMap: normalMap,
    //normalScale: new THREE.Vector2(0.7, 0.7),
    //bumpMap: bumpMap,
    bumpScale: 2,
    roughness: 1,
    metalness: 0
});
const earth = new THREE.Mesh(new THREE.SphereGeometry(kilometersToGameUnit(6371), 128, 128), earthMaterial);
earthPivot.add(earth);

const axes = new THREE.AxesHelper(kilometersToGameUnit(10000));
earth.add(axes);


//WIREFRAME (Do lat-long version)
/*const wireGeo = new THREE.SphereGeometry(kilometersToGameUnit(6371 + 50), 32, 32);
const wireMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true
});

const wireSphere = new THREE.Mesh(wireGeo, wireMat);
earth.add(wireSphere);*/


//CLOUDS
const cloudTexture = loader.load('images/8k_earth_clouds.jpg');
const cloudMaterial = new THREE.MeshStandardMaterial({
    alphaMap: cloudTexture,
    transparent: true,
    opacity: 1.3,
    depthWrite: false, //Prevents z-fighting so cloud doesn't block planet normals
    //side: THREE.DoubleSide,
});
const clouds = new THREE.Mesh(new THREE.SphereGeometry(kilometersToGameUnit(6371 + 5), 128, 128), cloudMaterial);
earth.add(clouds); //Moves with the earth (earth is the parent)

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


//CAMERA
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1e9);
camera.position.x = earthPivot.position.x;
camera.position.z = kilometersToGameUnit(15000);
scene.add(camera); //Needed if want to attach something to the camera


//BLOOM
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomParams = {
    strength: 50,    // intensity of bloom, def: 200
    radius: 1,        // glow radius
    threshold: 0.6    // minimum brightness to bloom, def: 0.6
};
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    bloomParams.strength,
    bloomParams.radius,
    bloomParams.threshold
);
composer.addPass(bloomPass);


//STARS
const starsTexture = new THREE.TextureLoader().load("images/8k_stars.jpg");
const starMat = new THREE.MeshBasicMaterial({
    map: starsTexture,
    side: THREE.BackSide,   //render inside of sphere
    transparent: true,
    opacity: 0.2,
    depthWrite: false
});
const starField = new THREE.Mesh(new THREE.SphereGeometry(150000000, 64, 64), starMat); //Radius big enough, that nothing goes beyond it.
scene.add(starField);


//CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.rotateSpeed = 0.5;
controls.enablePan = false; //Panning off for now
controls.target.copy(earthPivot.position);


//ANIMATE LOOP
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

let count = 0;
let lastTime = 0;
function animate(time) { //Time keeps increasing (ms)
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    earth.rotation.y += 0.144 * delta;
    clouds.rotation.y += 0.014 * delta;

    starField.position.copy(camera.position);

    count += delta;

    if (count >= 1) {
        //Updates every second.
        count = 0;
    }

    controls.update();

    composer.render(scene, camera);
}

function kilometersToGameUnit(km) {
    return km / unitScalingFactor;
}

function milesToKilometers(miles) {
    return miles * 1.609;
}

function milesToGameUnit(miles) {
    return kilometersToGameUnit(milesToKilometers(miles));
}

function gameUnitToKilometers(gameUnit) {
    return gameUnit * unitScalingFactor;
}

//Not sure if this is correct
function lightIntensityToGameIntensity(intensity) {
    return intensity / (unitScalingFactor ** 2);
}