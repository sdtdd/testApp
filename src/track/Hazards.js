/**
 * Hazards - 落とし穴（ピット）の3D生成
 */
import * as THREE from 'three';
import { disposeObject } from '../core/utils.js';
import { holes } from './TrackData.js';

export class Hazards {
    constructor(scene) {
        this.scene = scene;
        this.group = null;
    }

    dispose() {
        if (this.group) {
            this.scene.remove(this.group);
            disposeObject(this.group);
            this.group = null;
        }
    }

    build() {
        this.dispose();
        this.group = new THREE.Group();
        for (const h of holes) this._createPit(h);
        this.scene.add(this.group);
    }

    _createPit(h) {
        const g = new THREE.Group();

        // 穴の内壁（内側から見えるように BackSide）
        const wallGeo = new THREE.CylinderGeometry(h.radius * 0.95, h.radius * 0.62, 7, 20, 1, true);
        const wallMat = new THREE.MeshLambertMaterial({ color: 0x2b1d12, side: THREE.BackSide });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.y = -3.5;
        g.add(wall);

        // 穴の底
        const floorGeo = new THREE.CircleGeometry(h.radius * 0.62, 18);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x120c07 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -6.9;
        g.add(floor);

        // 注意リング（路面に黄色の輪）
        const ringGeo = new THREE.RingGeometry(h.radius - 0.35, h.radius + 0.75, 26);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb300, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.14;
        g.add(ring);

        // 黒い内側（穴の中身が見えるように）
        const innerGeo = new THREE.CircleGeometry(h.radius - 0.3, 22);
        const innerMat = new THREE.MeshBasicMaterial({ color: 0x0a0705, side: THREE.DoubleSide });
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.rotation.x = -Math.PI / 2;
        inner.position.y = 0.1;
        g.add(inner);

        // 注意コーン
        const coneGeo = new THREE.ConeGeometry(0.35, 0.9, 6);
        const coneMat = new THREE.MeshPhongMaterial({ color: 0xff6d00 });
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.set(Math.cos(a) * (h.radius + 1.3), 0.45, Math.sin(a) * (h.radius + 1.3));
            cone.castShadow = true;
            g.add(cone);
        }

        g.position.set(h.x, h.y, h.z);
        this.group.add(g);
    }
}
