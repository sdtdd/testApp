/**
 * TrackBuilder - トラックの3Dメッシュ生成（路面、スタートゲート）
 * 幅はセンターライン点ごとに異なる（狭い区間あり）。路面種別で色を分ける。
 */
import * as THREE from 'three';
import { disposeObject } from '../core/utils.js';
import { trackPath, trackTheme } from './TrackData.js';
import { lanePaintSections } from './TrackData.js';

export class TrackBuilder {
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
        this._buildRoad();
        this._buildLanePaint();
        // 縁石（等間隔のカラーバー）は削除済み
        this._buildStartLine();
        this._buildGate();
        this.scene.add(this.group);
    }

    /** 左方向ベクトルは (cos h, -sin h)（heading: forward = (sin h, cos h)） */
    _edgePoint(p, side) {
        const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
        return { x: p.x + lx * side * p.halfWidth, z: p.z + lz * side * p.halfWidth, y: p.y };
    }

    _buildRoad() {
        const n = trackPath.length;
        const left = [], right = [];
        for (let i = 0; i < n; i++) {
            left.push(this._edgePoint(trackPath[i], 1));
            right.push(this._edgePoint(trackPath[i], -1));
        }

        const buckets = new Map();
        const bucketFor = (surface) => {
            if (!buckets.has(surface)) buckets.set(surface, { verts: [], idx: [], map: new Map() });
            return buckets.get(surface);
        };
        const pushPoint = (b, i) => {
            if (b.map.has(i)) return b.map.get(i);
            const base = b.verts.length / 3;
            b.verts.push(left[i].x, left[i].y + 0.05, left[i].z);
            b.verts.push(right[i].x, right[i].y + 0.05, right[i].z);
            b.map.set(i, base);
            return base;
        };

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const b = bucketFor(trackPath[i].surface || 'road');
            const a = pushPoint(b, i);
            const c = pushPoint(b, j);
            b.idx.push(a, a + 1, c, a + 1, c + 1, c);
        }

        for (const [surface, b] of buckets) {
            if (b.verts.length === 0) continue;
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(b.verts, 3));
            geo.setIndex(b.idx);
            geo.computeVertexNormals();

            let mat;
            if (surface === 'slick') {
                mat = new THREE.MeshPhongMaterial({ color: trackTheme.slick, shininess: 110, specular: 0xffffff });
            } else {
                mat = new THREE.MeshLambertMaterial({ color: surface === 'mud' ? trackTheme.mud : trackTheme.road });
            }
            const road = new THREE.Mesh(geo, mat);
            road.receiveShadow = true;
            this.group.add(road);
        }

        // 中央の破線
        const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let i = 0; i < n; i += 8) {
            if ((i / 8) % 2 !== 0) continue;
            const pt = trackPath[i];
            const nx2 = trackPath[(i + 4) % n];
            const dx = nx2.x - pt.x, dz = nx2.z - pt.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            if (len < 0.1) continue;
            const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, len), dashMat);
            dash.position.set((pt.x + nx2.x) / 2, (pt.y + nx2.y) / 2 + 0.09, (pt.z + nx2.z) / 2);
            dash.rotation.x = -Math.PI / 2;
            // 破線を進行方向に沿わせる（スピン後に local +Y が travel 方向になる）
            dash.rotation.z = Math.PI + pt.heading;
            this.group.add(dash);
        }
    }


    /**
     * lanePaint（course の fraction range）の 3-lane分割・race paint line の生成.
     * Each section draws a pair of divider lines at +/-1/3 of the local halfWidth,
     * each divider being a white stroke plus a coloured companion stroke outside it.
     * Paint is a decal ribbon laid just above the road surface (road top = y + 0.05).
     */
    _buildLanePaint() {
        const sections = lanePaintSections;
        if (!sections || sections.length === 0) return;          // courses without lanePaint skip
        const n = trackPath.length;
        if (n < 16) return;

        const buckets = new Map();   // color -> { verts, idx }

        for (const sec of sections) {
            const from = ((sec.from % 1) + 1) % 1;
            const to = ((sec.to % 1) + 1) % 1;
            const a0 = Math.round(from * n);
            let a1 = Math.round(to * n);
            if (a1 <= a0) a1 += n;                 // start/finish の wrap-around section
            const span = a1 - a0;
            if (span < 4) continue;

            for (const side of [-1, 1]) {
                const specs = [
                    { laneFrac: 0.34, gap: 0, halfW: 0.26, color: 0xf4f1ea },   // main white divider
                    { laneFrac: 0.34, gap: 1.25, halfW: 0.18, color: trackTheme.curbA } // companion stroke
                ];
                for (const spec of specs) {
                    const verts = [], idx = [];
                    for (let k = 0; k <= span; k++) {
                        const p = trackPath[(((a0 + k) % n) + n) % n];
                        const lx = Math.cos(p.heading), lz = -Math.sin(p.heading); // same as _edgePoint
                        const hw = p.halfWidth;
                        const centre = side * (hw * spec.laneFrac + spec.gap);
                        const taper = Math.min(1, (k + 0.5) / 5, (span - k + 0.5) / 5); // fade in/out at ends
                        const half = spec.halfW * Math.max(0.12, taper);
                        const y = p.y + 0.075;
                        verts.push(p.x + lx * (centre - half), y, p.z + lz * (centre - half));
                        verts.push(p.x + lx * (centre + half), y, p.z + lz * (centre + half));
                    }
                    for (let k = 0; k < span; k++) {
                        const a = k * 2, c = a + 2;
                        idx.push(a, a + 1, c, a + 1, c + 1, c);
                    }
                    let bucket = buckets.get(spec.color);
                    if (!bucket) {
                        bucket = { verts: [], idx: [] };
                        buckets.set(spec.color, bucket);
                    }
                    const base = bucket.verts.length / 3;
                    for (let i = 0; i < verts.length; i++) bucket.verts.push(verts[i]);
                    for (let i = 0; i < idx.length; i++) bucket.idx.push(idx[i] + base);
                }
            }
        }

        for (const [color, bucket] of buckets) {
            if (bucket.idx.length === 0) continue;
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.verts, 3));
            geo.setIndex(bucket.idx);
            geo.computeVertexNormals();
            const paint = new THREE.Mesh(geo, this._lanePaintMaterial(color));
            this.group.add(paint);
        }
    }

    /** lane paint の decal material cache（same color の same material を return） */
    _lanePaintMaterial(color) {
        if (!this.lanePaintMats) this.lanePaintMats = new Map();
        const hit = this.lanePaintMats.get(color);
        if (hit) return hit;
        const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthWrite: false });
        this.lanePaintMats.set(color, mat);
        return mat;
    }

    _buildStartLine() {
        const p = trackPath[0];
        const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
        const cells = 8;
        const cellW = (p.halfWidth * 2) / cells;
        for (let c = 0; c < cells; c++) {
            const off = -p.halfWidth + (c + 0.5) * cellW;
            const cell = new THREE.Mesh(
                new THREE.PlaneGeometry(cellW * 0.94, 3),
                new THREE.MeshBasicMaterial({ color: c % 2 === 0 ? 0xffffff : 0x111111 })
            );
            cell.rotation.x = -Math.PI / 2;
            cell.rotation.z = Math.PI + p.heading;
            cell.position.set(p.x + lx * off, p.y + 0.12, p.z + lz * off);
            this.group.add(cell);
        }
    }

    _buildGate() {
        const p = trackPath[0];
        this._createArchGate(p.x, p.z, p.heading, p.y, p.halfWidth);
    }

    _createArchGate(x, z, angle, y, halfWidth) {
        const group = new THREE.Group();
        const pillarGeo = new THREE.CylinderGeometry(0.5, 0.7, 9, 8);
        const pillarMat = new THREE.MeshPhongMaterial({ color: 0xdd3333 });
        for (const side of [-1, 1]) {
            const p = new THREE.Mesh(pillarGeo, pillarMat);
            p.position.set(side * (halfWidth + 1.6), 4.5, 0);
            p.castShadow = true;
            group.add(p);
        }
        const span = halfWidth * 2 + 1.4;
        for (let i = 0; i < 10; i++) {
            const w = span / 10;
            const sq = new THREE.Mesh(
                new THREE.BoxGeometry(w, 1.3, 1.1),
                new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffffff : 0x111111 })
            );
            sq.position.set(-span / 2 + (i + 0.5) * w, 9.3, 0);
            group.add(sq);
        }
        group.position.set(x, y, z);
        // ゲートはトラック方向に対して横向き（横断する形）になるように Y 回転
        group.rotation.y = angle;
        this.group.add(group);
    }
}
