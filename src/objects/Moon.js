export default class Moon {
    constructor(radiusKm, axialTilt, rotationSpeed) {
        this.group = new THREE.Group(); //The parent of everything. Handles position at least.
        this.selected = false;

        this.rotationSpeed = rotationSpeed;
        this.axialTilt = new THREE.Object3D();
        this.group.add(this.axialTilt);

        this.moonMesh = createEarthMesh(radiusKm)
        this.axialTilt.add(this.moonMesh);
        this.moonMesh.name = "MoonMesh";

        this.axes = new THREE.AxesHelper(kmToGameUnit(10000));
        this.earthMesh.add(this.axes);

        this.axesGlobal = new THREE.AxesHelper(kmToGameUnit(20000));
        this.group.add(this.axesGlobal);

        this.sunDirectionVector = new THREE.Vector3(-1, 0, 0); //Placeholder, updated in update()
        this.sunDirectionLine = createSunDirectionLine();
        this.group.add(this.sunDirectionLine);
    }

}