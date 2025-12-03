import * as THREE from 'three';
import CelestialBody from './CelestialBody';

export default class Sun extends CelestialBody {
    constructor(radiusKm) {
        super(radiusKm);

        this.group.position.set(0, 0, 0);
        this.mesh.name = "SunMesh"; //TODO: Selecting the sun with bloom is harder, might need to create a larger selection mesh when bloom is enabled

        const sunLight = new THREE.PointLight(0xffffff, 80000000, 0, 1.5); //Less than square decay for now, since the distances are big
        this.group.add(sunLight);
    }

    getMaterialProperties() {
        return {
            texturePath: 'images/8k_sun.jpg',
            //color: 0xffffff,
            emissive: 0xffffff, //TODO: If the sun is emissive, it cannot render the color map. Maybe swap materials when getting close
            emissiveIntensity: 7,
            roughness: 1,
            metalness: 0,
        };
    }
}