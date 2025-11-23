import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function createRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    return renderer;
}

//TODO: Do selective bloom and make sure atmosphere is visible when bloom not active on it
export function createBloomComposer(renderer, scene, camera) {
    const bloomComposer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    //bloomComposer.renderToScreen = false;
    bloomComposer.addPass(renderPass);

    const bloomParams = {
        strength: 50,     //intensity of bloom, def: 200
        radius: 1,        //glow radius
        threshold: 5      //minimum brightness to bloom, def: 1
    };
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        bloomParams.strength,
        bloomParams.radius,
        bloomParams.threshold
    );
    bloomComposer.addPass(bloomPass);
    return bloomComposer;
}

/*export function createFinalComposer(renderer, scene, camera, bloomComposer) {
    const finalComposer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    finalComposer.addPass(renderPass);
    const mergePass = new ShaderPass(THREE.AdditiveBlendShader);
    finalComposer.addPass(mergePass);

    return finalComposer;
}*/
