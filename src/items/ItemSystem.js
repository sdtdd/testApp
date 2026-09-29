import * as THREE from 'three';
import { trackPath, holeAt } from '../track/TrackData.js';

const ITEM_TYPES = ['mushroom', 'banana', 'shell'];

/**
 * ItemSystem - アイテムボックス、アイテムモデル生成、使用効果、アクティブアイテム管理
 */
export class ItemSystem {
    constructor(scene, particles) {
        this.scene = scene;
        this.particles = particles;
        this.itemBoxes = [];
        this.activeItems = [];
    }

    spawnItemBoxes() {
        for (let i = 0; i < trackPath.length; i += 25) {
            const pt = trackPath[i];
            const lx = Math.cos(pt.heading), lz = -Math.sin(pt.heading); // 左方向ベクトル
            const limit = Math.max(1, pt.halfWidth - 1.6);
            for (const offset of [-limit, 0, limit]) {
                const bx = pt.x + lx * offset;
                const bz = pt.z + lz * offset;
                if (holeAt(bx, bz)) continue; // 落とし穴の上には置かない
                const boxMesh = this._createItemBoxModel();
                const baseY = pt.y + 1.2;
                boxMesh.position.set(bx, baseY, bz);
                this.scene.add(boxMesh);
                this.itemBoxes.push({ mesh: boxMesh, x: bx, z: bz, y: baseY, active: true, respawnTimer: 0, respawnDuration: 60, popTimer: 0, popDuration: 12 });
            }
        }
    }

    update(karts) {
        for (const box of this.itemBoxes) {
            // --- pop-away animation（scale 1.6→0）then scale-in respawn（0→1）---
            if (box.popTimer > 0) {
                box.popTimer--;
                const t = box.popTimer / box.popDuration;
                const s = 1.6 * t * t; // ease-out shrink from pop-scale to 0
                box.mesh.scale.set(s, s, s);
                continue;
            }

            if (box.respawnTimer > 0) {
                box.respawnTimer--;
                const progress = 1 - (box.respawnTimer / box.respawnDuration);
                const s = progress * progress * (3 - 2 * progress); // smoothstep grow
                box.mesh.scale.set(s, s, s);
                if (box.respawnTimer <= 0) {
                    box.mesh.scale.set(1, 1, 1);
                    box.active = true; // respawn complete → box is collectible again
                }
                continue;
            }

            if (!box.active) continue;

            box.mesh.rotation.y += 0.03;
            box.mesh.position.y = box.y + Math.sin(Date.now() * 0.003) * 0.2;

            for (const kart of karts) {
                const dx = kart.x - box.x, dz = kart.z - box.z;
                if (dx * dx + dz * dz < 3.24 && !kart.item) { // 1.8^2 = 3.24
                    kart.item = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];

                    // --- pop effect: burst particles + start shrink animation ---
                    this._popEffect(box);
                    box.active = false;
                    box.popTimer = 12;
                    box.popDuration = 12;
                    box.respawnTimer = 60;       // grow phase ~2s at 30fps
                    box.respawnDuration = 60;

                    break;
                }
            }
        }

        for (let i = this.activeItems.length - 1; i >= 0; i--) {
            const item = this.activeItems[i];
            item.timer--;

            if (item.type === 'shell') {
                item.x += Math.sin(item.angle) * item.speed;
                item.z += Math.cos(item.angle) * item.speed;
                item.mesh.position.set(item.x, 0.5, item.z);
                item.mesh.rotation.y += 0.1;
            } else if (item.type === 'banana') {
                item.mesh.rotation.y += 0.02;
            }

            for (const kart of karts) {
                const dx = kart.x - item.x, dz = kart.z - item.z;
                if (Math.sqrt(dx * dx + dz * dz) < 1.5) {
                    kart.slowTimer = 60;
                    this.particles.spawn(kart.x, kart.z, kart.angle, 0xff9800);
                    this.scene.remove(item.mesh);
                    this.activeItems.splice(i, 1);
                    break;
                }
            }

            if (item.timer <= 0 && this.activeItems[i]) {
                this.scene.remove(item.mesh);
                this.activeItems.splice(i, 1);
            }
        }
    }

    useItem(kart) {
        if (!kart.item) return;
        const type = kart.item;
        kart.item = null;

        if (type === 'mushroom') {
            kart.boostTimer = 90;
            this.particles.spawn(kart.x, kart.z, kart.angle, 0xffeb3b);
        } else if (type === 'banana') {
            const bx = kart.x - Math.sin(kart.angle) * 2.5;
            const bz = kart.z - Math.cos(kart.angle) * 2.5;
            const mesh = this._createItemModel('banana');
            mesh.position.set(bx, 0.3, bz);
            this.scene.add(mesh);
            this.activeItems.push({ type: 'banana', x: bx, z: bz, timer: 600, mesh });
        } else if (type === 'shell') {
            const mesh = this._createItemModel('shell');
            mesh.position.set(kart.x, 0.5, kart.z);
            this.scene.add(mesh);
            this.activeItems.push({ type: 'shell', x: kart.x, z: kart.z, timer: 400, speed: 1.2, angle: kart.angle, mesh });
        }
    }


    /** パック・effect（scale-up flash + particle burst）*/
    _popEffect(box) {
        // spawn particles at box position (cyan/gold burst)
        this.particles.spawn(box.x, box.z, 0, 0x4fc3f7, box.y);
        this.particles.spawn(box.x, box.z, Math.PI, 0xffd54f, box.y);

        // quick scale-up flash before hiding (handled in next frame via mesh removal)
        if (box.mesh) {
            box.mesh.scale.set(1.6, 1.6, 1.6);
        }
    }

    _createItemBoxModel() {
        const size = 1.1;
        const geo = new THREE.BoxGeometry(size, size, size);

        // --- Solid (opaque) box body — no transparency ---
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0x4fc3f7,
            transparent: false,
            opacity: 1.0,
            roughness: 0.15,
            metalness: 0.35,
            clearcoat: 0.8,
            clearcoatRoughness: 0.1,
            envMapIntensity: 1.2,
            side: THREE.DoubleSide
        });
        const box = new THREE.Mesh(geo, mat);

        // --- "?" texture を each face の apply（Canvas-generated）---
        const questionTexture = this._makeQuestionTexture();
        const faceMat = new THREE.MeshBasicMaterial({
            map: questionTexture,
            transparent: true,
            opacity: 1.0,
            depthWrite: true,
            side: THREE.DoubleSide
        });

        // each の 6 faces の "?" decal を place
        const faceSize = size * 1.02;
        const planeGeo = new THREE.PlaneGeometry(faceSize, faceSize);
        const halfOff = size / 2 + 0.01;

        // +Z face
        const f1 = new THREE.Mesh(planeGeo, faceMat);
        f1.position.set(0, 0, halfOff);
        box.add(f1);
        // -Z face
        const f2 = new THREE.Mesh(planeGeo, faceMat);
        f2.position.set(0, 0, -halfOff);
        f2.rotation.y = Math.PI;
        box.add(f2);
        // +X face
        const f3 = new THREE.Mesh(planeGeo, faceMat);
        f3.position.set(halfOff, 0, 0);
        f3.rotation.y = Math.PI / 2;
        box.add(f3);
        // -X face
        const f4 = new THREE.Mesh(planeGeo, faceMat);
        f4.position.set(-halfOff, 0, 0);
        f4.rotation.y = -Math.PI / 2;
        box.add(f4);
        // +Y face
        const f5 = new THREE.Mesh(planeGeo, faceMat);
        f5.position.set(0, halfOff, 0);
        f5.rotation.x = -Math.PI / 2;
        box.add(f5);
        // -Y face
        const f6 = new THREE.Mesh(planeGeo, faceMat);
        f6.position.set(0, -halfOff, 0);
        f6.rotation.x = Math.PI / 2;
        box.add(f6);

        // --- glowing edge wireframe overlay（MK8-style glow border）---
        const edgeGeo = new THREE.BoxGeometry(size + 0.04, size + 0.04, size + 0.04);
        const edgeMat = new THREE.MeshBasicMaterial({
            color: 0x81d4fa,
            wireframe: true,
            transparent: false,
            opacity: 1.0
        });
        const edges = new THREE.Mesh(edgeGeo, edgeMat);
        box.add(edges);

        // --- inner glow core（small bright sphere inside）---
        const glowGeo = new THREE.SphereGeometry(0.25, 12, 12);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: false,
            opacity: 1.0
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        box.add(glow);

        return box;
    }

    /** "?" の Canvas texture を generate（transparent background・big question mark）*/
    _makeQuestionTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // transparent background
        ctx.clearRect(0, 0, 128, 128);

        // draw "?" symbol
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 3;
        ctx.font = 'bold 96px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 64, 68);
        ctx.strokeText('?', 64, 68);

        // subtle glow around the mark
        ctx.shadowColor = '#4fc3f7';
        ctx.shadowBlur = 12;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('?', 64, 68);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    _createItemModel(type) {
        if (type === 'mushroom') return this._createMushroomModel();
        if (type === 'banana') return this._createBananaModel();
        return this._createShellModel();
    }

    _createMushroomModel() {
        const group = new THREE.Group();
        const stemGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.5, 8);
        const stemMat = new THREE.MeshPhongMaterial({ color: 0xfff8dc });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.25;
        group.add(stem);

        const capGeo = new THREE.SphereGeometry(0.4, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const capMat = new THREE.MeshPhongMaterial({ color: 0xe53935 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = 0.5;
        group.add(cap);

        for (let i = 0; i < 5; i++) {
            const spotGeo = new THREE.SphereGeometry(0.07, 6, 6);
            const spotMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
            const spot = new THREE.Mesh(spotGeo, spotMat);
            const phi = Math.random() * Math.PI * 0.4 + 0.1;
            const theta = (i / 5) * Math.PI * 2;
            spot.position.set(
                0.38 * Math.sin(phi) * Math.cos(theta),
                0.5 + 0.38 * Math.cos(phi),
                0.38 * Math.sin(phi) * Math.sin(theta)
            );
            group.add(spot);
        }
        return group;
    }

    _createBananaModel() {
        const group = new THREE.Group();
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-0.4, 0.1, 0),
            new THREE.Vector3(0, 0.5, 0),
            new THREE.Vector3(0.4, 0.1, 0)
        );
        const tubeGeo = new THREE.TubeGeometry(curve, 8, 0.12, 6, false);
        const bananaMat = new THREE.MeshPhongMaterial({ color: 0xffeb3b });
        const banana = new THREE.Mesh(tubeGeo, bananaMat);
        group.add(banana);

        const tipGeo = new THREE.SphereGeometry(0.06, 5, 5);
        const tipMat = new THREE.MeshPhongMaterial({ color: 0x8d6e1a });
        const t1 = new THREE.Mesh(tipGeo, tipMat);
        t1.position.set(-0.4, 0.1, 0);
        group.add(t1);
        const t2 = new THREE.Mesh(tipGeo, tipMat);
        t2.position.set(0.4, 0.1, 0);
        group.add(t2);
        return group;
    }

    _createShellModel() {
        const group = new THREE.Group();
        const shellGeo = new THREE.SphereGeometry(0.35, 8, 8);
        const shellMat = new THREE.MeshPhongMaterial({ color: 0x43a047 });
        const shell = new THREE.Mesh(shellGeo, shellMat);
        shell.position.y = 0.35;
        group.add(shell);

        const spikeGeo = new THREE.ConeGeometry(0.08, 0.25, 4);
        const spikeMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            spike.position.set(
                Math.cos(angle) * 0.45,
                0.35,
                Math.sin(angle) * 0.45
            );
            spike.rotation.z = -angle + Math.PI / 2;
            spike.rotation.x = Math.PI / 2;
            group.add(spike);
        }
        return group;
    }

    clear() {
        for (const box of this.itemBoxes) {
            if (box.mesh.parent) this.scene.remove(box.mesh);
        }
        this.itemBoxes = [];
        for (const item of this.activeItems) {
            this.scene.remove(item.mesh);
        }
        this.activeItems = [];
    }
}

