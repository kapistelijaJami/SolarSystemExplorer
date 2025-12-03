import * as THREE from 'three';
import * as gameUtil from '@/util/gameUtil';
import CelestialBody, { createLatitudeLines, createLongitudeLines } from '@/objects/CelestialBody'

export default class Moon extends CelestialBody {
    constructor(radiusKm) {
        super(radiusKm);

        this.mesh.name = "MoonMesh";

        this.sunDirectionVector = new THREE.Vector3(-1, 0, 0); //Placeholder, updated in update()
        this.sunDirectionLine = gameUtil.createLine(0xffff00);
        this.group.add(this.sunDirectionLine);

        this.latLines = createLatitudeLines(gameUtil.kmToGameUnit(radiusKm + 10), 128, 17, 0x070707);
        this.longLines = createLongitudeLines(gameUtil.kmToGameUnit(radiusKm + 10), 128, 36, gameUtil.kmToGameUnit(10), 0x070707);
        this.mesh.add(this.latLines);
        this.mesh.add(this.longLines);

        this.latLines.visible = false;
        this.longLines.visible = false;

        this.toggleGlobalAxes();
    }

    getMaterialProperties() {
        return {
            texturePath: 'images/moon_lroc_color_poles_8k.jpg',
            bumpMapPath: 'images/moon_ldem_4_displacement.jpg',
            bumpScale: 0.3,
            displacementScale: 0.01,     // how strong the bumps are
            displacementBias: 0.0,      // shifts displacement up/down
            roughness: 1,
            metalness: 0,
        };
    }

    update(delta, app) {
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
}