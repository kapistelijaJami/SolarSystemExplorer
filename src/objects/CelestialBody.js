
class CelestialBody {
    constructor(radiusKm, axialTilt, rotationSpeed) {
        this.radiusKm = radiusKm;
    }

    createMesh(texturePath, normalPath) {
        const loader = new THREE.TextureLoader();
        const colorMap = loader.load(texturePath);
        const normalMap = loader.load(normalPath);

        const material = new THREE.MeshStandardMaterial({
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
        //material.normalScale = new THREE.Vector2(0.0, 0.0);

        return new THREE.Mesh(new THREE.SphereGeometry(kmToGameUnit(this.radiusKm), 128, 128), material);
    }
}