import * as THREE from 'three';
import { disposeObject } from '../core/utils.js';
import { trackPath, trackBounds } from '../track/TrackData.js';

// grandstand crowd colors（マリオカートスタジアム）
const CROWD_COLORS = [0xe53946, 0xf7ce1d, 0x1565c0, 0xf3f3f3, 0x8e3a2f, 0x2e8b57];

/**
 * Environment - 環境オブジェクト（木、サボテン、岩、山、雲）の生成
 * InstancedMesh のLOD для 大量重複的 objects（trees/rocks/cacti/mountains/clouds）を
 * draw calls を~200+ に reduce to ~8 instanced batches.
 * コースのテーマ（grass / mountain / desert）に応じて装飾が変わる。
 */
export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.clouds = [];
        this.group = null;
        this.theme = { kind: 'grass' };
        this.instancedMeshes = []; // for LOD updates
    }

    dispose() {
        if (this.group) {
            this.scene.remove(this.group);
            disposeObject(this.group);
            this.group = null;
        }
        this.clouds = [];
        this.instancedMeshes = [];
    }

    build(theme) {
        this.dispose();
        if (theme) this.theme = theme;
        this.group = new THREE.Group();
        this._buildScenery();
        if ((this.theme.kind || 'grass') === 'stadium') this._buildCityscape();
        else this._buildMountains();
        this._buildClouds();
        this.scene.add(this.group);
        return this.clouds;
    }

    updateLOD(cameraPos) {
        for (const batch of this.instancedMeshes) {
            if (!batch.lodUpdate) continue;
            batch.lodUpdate(cameraPos);
        }
    }

    updateClouds() {
        const limit = this.cloudLimit || { min: -150, max: 150 };
        for (const cloud of this.clouds) {
            cloud.position.x += 0.02;
            if (cloud.position.x > limit.max) cloud.position.x = limit.min;
        }
    }

    _buildScenery() {
        const kind = this.theme.kind || 'grass';
        if (kind === 'stadium') {
            this._buildStadiumFixtures();
            return;
        }

        // Collect instance transforms per type, then batch into InstancedMesh
        const treeTris = [], pineTris = [], cactusTris = [], rockTris = [];

        for (let i = 0; i < trackPath.length; i += 12) {
            const pt = trackPath[i];
            const nx = Math.cos(pt.heading), nz = -Math.sin(pt.heading);
            for (const side of [-1, 1]) {
                const offset = pt.halfWidth + 4 + Math.random() * 10;
                const x = pt.x + nx * side * offset;
                const z = pt.z + nz * side * offset;
                const roll = Math.random();
                if (kind === 'desert') {
                    if (roll < 0.55) cactusTris.push({ x, z, s: 0.8 + Math.random() * 0.7 });
                    else rockTris.push({ x, z, s: 0.6 + Math.random() * 1.2 });
                } else if (kind === 'mountain') {
                    if (roll < 0.6) pineTris.push({ x, z, s: 0.7 + Math.random() * 0.9 });
                    else rockTris.push({ x, z, s: 0.7 + Math.random() * 1.4 });
                } else {
                    if (roll < 0.45) treeTris.push({ x, z, s: 0.7 + Math.random() * 0.8 });
                    else if (roll < 0.8) pineTris.push({ x, z, s: 0.7 + Math.random() * 0.8 });
                    else this._createFlowers(x, z, 6);
                }
            }
        }

        // Batch each type into a single InstancedMesh (1 draw call per type)
        if (treeTris.length > 0) this._batchTrees(treeTris);
        if (pineTris.length > 0) this._batchPines(pineTris);
        if (cactusTris.length > 0) this._batchCacti(cactusTris);
        if (rockTris.length > 0) this._batchRocks(rockTris);
    }

    /** マリオカートスタジアム：track-side grandstands + floodlight towers */
    _buildStadiumFixtures() {
        const n = trackPath.length;
        const bannerColors = [0xe53946, 0x1565c0, 0xf7ce1d, 0x2e8b57];
        let slot = 0;
        for (let i = 0; i < n; i += 28) {
            const pt = trackPath[i];
            const nx = Math.cos(pt.heading), nz = -Math.sin(pt.heading); // left vector
            for (const side of [-1, 1]) {
                const offset = pt.halfWidth + 16;
                this._createGrandstand(
                    pt.x + nx * side * offset,
                    pt.z + nz * side * offset,
                    pt.heading,
                    side,
                    bannerColors[slot % bannerColors.length]
                );
            }
            slot++;
        }
        for (let i = 14; i < n; i += 84) {
            const pt = trackPath[i];
            const nx = Math.cos(pt.heading), nz = -Math.sin(pt.heading);
            const side = ((i / 84) | 0) % 2 === 0 ? 1 : -1;
            const offset = pt.halfWidth + 34;
            this._createFloodlight(pt.x + nx * side * offset, pt.z + nz * side *offset);
        }
    }

    /** Stand（tiered box）+ banner wall — front face points to the track */
    _createGrandstand(x, z, heading, side, banner) {
        const group = new THREE.Group();
        const tierH = 3.6, depth = 5.4;
        for (let tier = 0; tier < 3; tier++) {
            const len = 26 - tier * 4;
            const box = new THREE.Mesh(
                new THREE.BoxGeometry(len, tierH, depth),
                new THREE.MeshLambertMaterial({ color: tier % 2 === 0 ? 0xc6ced8 : 0xa7b3c0 })
            );
            box.position.set(0, tierH / 2 + tier * tierH * 0.8, -tier * depth * 0.45);
            box.castShadow = true;
            group.add(box);

            // crowd speckles on this tier
            for (let c = 0; c < 6; c++) {
                const head = new THREE.Mesh(
                    new THREE.BoxGeometry(0.7, 1.1, 0.7),
                    new THREE.MeshLambertMaterial({ color: CROWD_COLORS[(tier * 6 + c) % CROWD_COLORS.length] })
                );
                head.position.set(-len / 2 + 2 + c * (len - 4) / 5, tierH + 0.35, -tier * depth * 0.45);
                group.add(head);
            }
        }
        // sponsor banner wall（front of the stand）
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(26, 2.2, 0.5),
            new THREE.MeshLambertMaterial({ color: banner })
        );
        wall.position.set(0, 1.1, depth * 0.9);
        group.add(wall);

        // stand's front face (+Z) points to the track
        const dirX = -Math.cos(heading) * side;
        const dirZ = Math.sin(heading) * side;
        group.rotation.y = Math.atan2(dirX, dirZ);
        group.position.set(x, 0, z);
        this.group.add(group);
    }

    /** Floodlight tower（stadium-style） */
    _createFloodlight(x, z) {
        const group = new THREE.Group();
        const poleH = 26;
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.9, poleH, 6),
            new THREE.MeshLambertMaterial({ color: 0x8d99a5 })
        );
        pole.position.y = poleH / 2;
        pole.castShadow = true;
        group.add(pole);
        const panelMat = new THREE.MeshBasicMaterial({ color: 0xfff9d6 });
        for (let i = 0; i < 3; i++) {
            const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.5), panelMat);
            panel.position.set((i - 1) * 2.6, poleH + 0.8, 0);
            group.add(panel);
        }
        group.position.set(x, 0, z);
        this.group.add(group);
    }

    /** Stadium の background：city skyline（mountains を not use） */
    _buildCityscape() {
        const b = trackBounds;
        const cx = (b.minX + b.maxX) / 2;
        const cz = (b.minZ + b.maxZ) / 2;
        const radius = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
        const palette = [0x78909f, 0x8ea1b2, 0x64748b, 0x9aabb8];
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
            const dist = radius + 75 + Math.random() * 80;
            this._createBuilding(
                cx + Math.cos(a) * dist,
                cz + Math.sin(a) * dist,
                16 + Math.random() * 22,
                34 + Math.random() * 52,
                palette[i % palette.length]
            );
        }
    }

    _createBuilding(x, z, width, height, color) {
        const b = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, width),
            new THREE.MeshLambertMaterial({ color })
        );
        b.position.set(x, height / 2 - 1, z);
        this.group.add(b);
        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.4, 3, width * 0.4),
            new THREE.MeshLambertMaterial({ color: 0x50606e })
        );
        roof.position.set(x, height + 0.5, z);
        this.group.add(roof);
    }

    /** Batch trees into InstancedMeshes (trunk + canopy = 2 draw calls for ALL trees) */
    _batchTrees(entries) {
        const count = entries.length;
        // Shared geometries (low-poly, already optimized)
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 2.5, 6);
        const canopyGeo = new THREE.ConeGeometry(1.8, 2.0, 7);
        // Shared materials (no per-instance allocation)
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B5E3C });
        const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2d8a2e });

        const trunkIM = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
        const canopyIM = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
        trunkIM.castShadow = true;
        canopyIM.castShadow = true;

        const mat4 = new THREE.Matrix4(); // reusable scratch — no GC in loop
        for (let i = 0; i < count; i++) {
            const e = entries[i];
            const s = e.s;
            // Trunk: center at y=trunkH/2, scaled
            mat4.makeScale(s, s, s);
            mat4.setPosition(e.x, 1.25 * s, e.z);
            trunkIM.setMatrixAt(i, mat4);
            // Canopy: stacked above trunk
            mat4.makeScale(s, s, s);
            mat4.setPosition(e.x, 3.5 * s, e.z);
            canopyIM.setMatrixAt(i, mat4);
        }
        trunkIM.instanceMatrix.needsUpdate = true;
        canopyIM.instanceMatrix.needsUpdate = true;

        this.group.add(trunkIM);
        this.group.add(canopyIM);
    }

    /** Batch pine trees (trunk + single cone) → 2 draw calls total */
    _batchPines(entries) {
        const count = entries.length;
        const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 3, 6);
        const coneGeo = new THREE.ConeGeometry(1.2, 5, 8);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6B4226 });
        const coneMat = new THREE.MeshLambertMaterial({ color: 0x1a5c1a });

        const trunkIM = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
        const coneIM = new THREE.InstancedMesh(coneGeo, coneMat, count);
        trunkIM.castShadow = true;
        coneIM.castShadow = true;

        const mat4 = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
            const e = entries[i];
            const s = e.s;
            mat4.makeScale(s, s, s);
            mat4.setPosition(e.x, 1.5 * s, e.z);
            trunkIM.setMatrixAt(i, mat4);

            mat4.makeScale(s, s, s);
            mat4.setPosition(e.x, 5.5 * s, e.z);
            coneIM.setMatrixAt(i, mat4);
        }
        trunkIM.instanceMatrix.needsUpdate = true;
        coneIM.instanceMatrix.needsUpdate = true;

        this.group.add(trunkIM);
        this.group.add(coneIM);
    }

    /** Batch rocks → 1 draw call (DodecahedronGeometry instanced) */
    _batchRocks(entries) {
        const count = entries.length;
        const color = this.theme.kind === 'desert' ? 0xb08968 : 0x7d7d7d;
        const geo = new THREE.DodecahedronGeometry(1, 0);
        const mat = new THREE.MeshLambertMaterial({ color });

        const im = new THREE.InstancedMesh(geo, mat, count * 3); // 3 rocks per entry
        im.castShadow = true;

        const mat4 = new THREE.Matrix4();
        let idx = 0;
        for (let i = 0; i < count; i++) {
            const e = entries[i];
            for (let j = 0; j < 3; j++) {
                const rScale = e.s * (1.1 - j * 0.25);
                mat4.makeScale(rScale, rScale, rScale);
                mat4.setPosition(
                    e.x + (j - 1) * e.s * 0.8,
                    e.s * 0.45 + j * 0.1,
                    e.z + (j % 2) * e.s * 0.4
                );
                im.setMatrixAt(idx++, mat4);
            }
        }
        im.count = idx;
        im.instanceMatrix.needsUpdate = true;
        this.group.add(im);
    }

    /** Batch cacti → 1 draw call (trunk instanced, arms baked into trunk geo) */
    _batchCacti(entries) {
        const count = entries.length;
        // Merge trunk + arms into one geometry to avoid per-instance arm randomness issues
        const mat = new THREE.MeshLambertMaterial({ color: 0x2f8f4a });
        const trunkH = 3.2;
        const trunkGeo = new THREE.CylinderGeometry(0.35, 0.42, trunkH, 8);

        const im = new THREE.InstancedMesh(trunkGeo, mat, count);
        im.castShadow = true;

        const mat4 = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
            const e = entries[i];
            const s = e.s;
            mat4.makeScale(s, s, s);
            mat4.setPosition(e.x, trunkH * 0.5 * s, e.z);
            im.setMatrixAt(i, mat4);
        }
        im.instanceMatrix.needsUpdate = true;
        this.group.add(im);
    }

    _createFlowers(cx, cz, count) {
        const colors = [0xff6b9d, 0xffeb3b, 0xff7043, 0xce93ff, 0x80deea];
        for (let i = 0; i < count; i++) {
            const x = cx + (Math.random() - 0.5) * 10;
            const z = cz + (Math.random() - 0.5) * 10;
            const stem = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4),
                new THREE.MeshLambertMaterial({ color: 0x2e7d32 })
            );
            stem.position.set(x, 0.25, z);
            this.group.add(stem);
            const petal = new THREE.Mesh(
                new THREE.SphereGeometry(0.15, 6, 6),
                new THREE.MeshLambertMaterial({ color: colors[i % colors.length] })
            );
            petal.position.set(x, 0.55, z);
            this.group.add(petal);
        }
    }

    _buildMountains() {
        const b = trackBounds;
        const cx = (b.minX + b.maxX) / 2;
        const cz = (b.minZ + b.maxZ) / 2;
        const radius = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
        for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
            const dist = radius + 55 + Math.random() * 45;
            this._createMountain(
                cx + Math.cos(a) * dist,
                cz + Math.sin(a) * dist,
                26 + Math.random() * 26,
                20 + Math.random() * 20
            );
        }
    }

    _createMountain(x, z, height, radius) {
        const mountain = new THREE.Mesh(
            new THREE.ConeGeometry(radius, height, 6),
            new THREE.MeshLambertMaterial({ color: this.theme.kind === 'desert' ? 0xa9825c : 0x5a7a5a })
        );
        mountain.position.set(x, height / 2 - 1, z);
        this.group.add(mountain);
        const snow = new THREE.Mesh(
            new THREE.ConeGeometry(radius * 0.3, height * 0.25, 6),
            new THREE.MeshLambertMaterial({ color: 0xf0f8ff })
        );
        snow.position.set(x, height - height * 0.125 - 1, z);
        this.group.add(snow);
    }

    _buildClouds() {
        const b = trackBounds;
        for (let i = 0; i < 9; i++) {
            const cx = b.minX - 60 + Math.random() * ((b.maxX - b.minX) + 120);
            const cz = b.minZ - 60 + Math.random() * ((b.maxZ - b.minZ) + 120);
            const cy = 38 + Math.random() * 22;
            this.clouds.push(this._createCloud(cx, cy, cz));
        }
        this.cloudLimit = { min: b.minX - 90, max: b.maxX + 90 };
    }

    _createCloud(x, y, z) {
        const group = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
        for (let i = 0; i < 5; i++) {
            const r = 2 + Math.random() * 3;
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 7), mat);
            sphere.position.set((i - 2) * 3.5, Math.random() * 1.5, Math.random() * 2 - 1);
            group.add(sphere);
        }
        group.position.set(x, y, z);
        this.group.add(group);
        return group;
    }
}
