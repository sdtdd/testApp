import * as THREE from 'three';
import { disposeObject } from '../core/utils.js';
import { trackPath, dashPadIndices } from './TrackData.js';

/**
 * DashPads - ダッシュパッド（ブーストストリップ）
 * 見やすさのポイント:
 *  - 路面に密着する発光プレート + 白枠（傾いた区間でも沈まないよう傾き追従）
 */
const PAD_LEN = 8;          // パッドの長さ（進行方向）

export class DashPads {
    constructor(scene) {
        this.scene = scene;
        this.pads = [];
        this.group = null;
    }

    dispose() {
        if (this.group) {
            this.scene.remove(this.group);
            disposeObject(this.group);
            this.group = null;
        }
        this.pads = [];
    }

    build() {
        this.dispose();
        this.group = new THREE.Group();
        const n = trackPath.length;

        // 共有ジオメトリ（矢印）: 先端が local +Y 方向を向く形
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(-1.3, 0);
        arrowShape.lineTo(0, 1.0);
        arrowShape.lineTo(1.3, 0);
        arrowShape.lineTo(0.65, 0);
        arrowShape.lineTo(0, 0.45);
        arrowShape.lineTo(-0.65, 0);
        arrowShape.closePath();
        const arrowGeo = new THREE.ShapeGeometry(arrowShape);

        for (const pi of dashPadIndices) {
            if (pi >= n) continue;
            const pt = trackPath[pi];
            const next = trackPath[(pi + 1) % n];
            const fwd = new THREE.Vector3(next.x - pt.x, (next.y || 0) - (pt.y || 0), next.z - pt.z);
            if (fwd.lengthSq() < 1e-6) continue;
            fwd.normalize();
            const angle = Math.atan2(next.x - pt.x, next.z - pt.z);

            const g = new THREE.Group();
            const padWidth = Math.max(3.4, Math.min(pt.halfWidth * 2 - 2, 9));

            // ---- 白枠（下地）と発光プレート ----
            const frame = new THREE.Mesh(
                new THREE.PlaneGeometry(padWidth + 0.9, PAD_LEN + 0.9),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            frame.rotation.x = -Math.PI / 2;
            frame.position.y = -0.02;
            g.add(frame);

            const plateMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85 });
            const plate = new THREE.Mesh(new THREE.PlaneGeometry(padWidth, PAD_LEN), plateMat);
            plate.rotation.x = -Math.PI / 2;
            g.add(plate);

            // ---- 流れる矢印 ----
            const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
            const chevrons = [];
            for (let c = 0; c < 4; c++) {
                const a = new THREE.Mesh(arrowGeo, arrowMat);
                a.rotation.x = -Math.PI / 2;   // 先端が進行方向(local -Z)を向く
                a.position.y = 0.04;
                g.add(a);
                chevrons.push(a);
            }

            // (ゲート・removed - no gate posts / caps / bar)

            // (bar arrow on gate removed)

            g.position.set(pt.x, pt.y + 0.14, pt.z);
            // local -Z を進行方向（丘の傾き込み）へ合わせる
            g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), fwd);

            this.group.add(g);
            this.pads.push({ x: pt.x, z: pt.z, y: pt.y, angle, mesh: g, chevrons, plateMat });
        }

        this.scene.add(this.group);   // ← シーンに登録（これが無いと表示されなかった）
    }

    /** 矢印を進行方向へ流し、プレートを明滅させる */
    update(t) {
        const count = 4;
        for (const pad of this.pads) {
            for (let i = 0; i < pad.chevrons.length; i++) {
                const phase = ((t * 2.2 + i * (PAD_LEN / count)) % PAD_LEN + PAD_LEN) % PAD_LEN;
                pad.chevrons[i].position.z = PAD_LEN / 2 - phase;   // +Z から -Z（前方）へ
            }
            pad.plateMat.opacity = 0.72 + 0.2 * Math.sin(t * 5);
        }
    }
}
