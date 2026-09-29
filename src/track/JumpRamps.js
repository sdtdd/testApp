import * as THREE from 'three';
import { disposeObject } from '../core/utils.js';
import { trackPath, jumpRampIndices } from './TrackData.js';

/**
 * JumpRamps - ジャンプリンプの生成と管理
 * 見やすさのポイント:
 *  - 傾斜面いっぱいに白い矢印（シェブロン）
 *  - 側面は赤白交互のフェンス、天端には発光バー
 *  - 手前に支柱付きの案内サイン（揺れるアニメーション）
 *  - 丘の傾きに合わせて全体がチルトする
 */
const RAMP_LEN = 6;
const RAMP_HEIGHT = 2.6;
const SIGN_HEIGHT = 7.0;   // 案内サインの高さ（ジャンプするカートの頭上を通す）

export class JumpRamps {
    constructor(scene) {
        this.scene = scene;
        this.ramps = [];
        this.group = null;
    }

    dispose() {
        if (this.group) {
            this.scene.remove(this.group);
            disposeObject(this.group);
            this.group = null;
        }
        this.ramps = [];
    }

    /** 上向きシェブロン（先端が local +Y） */
    _chevron(halfW, h, notch) {
        const s = new THREE.Shape();
        s.moveTo(-halfW, 0);
        s.lineTo(0, h);
        s.lineTo(halfW, 0);
        s.lineTo(halfW * 0.45, 0);
        s.lineTo(0, notch);
        s.lineTo(-halfW * 0.45, 0);
        s.closePath();
        return new THREE.ShapeGeometry(s);
    }

    build() {
        this.dispose();
        this.group = new THREE.Group();
        const n = trackPath.length;
        const slopeAngle = Math.atan2(RAMP_HEIGHT * 0.7, RAMP_LEN);
        const slopeGeo = this._chevron(1.15, 0.95, 0.42);
        const signGeo = this._chevron(1.1, 1.3, 0.5);

        for (const pi of jumpRampIndices) {
            if (pi >= n) continue;
            const pt = trackPath[pi];
            const next = trackPath[(pi + 1) % n];
            const fwd = new THREE.Vector3(next.x - pt.x, (next.y || 0) - (pt.y || 0), next.z - pt.z);
            if (fwd.lengthSq() < 1e-6) continue;
            fwd.normalize();
            const angle = Math.atan2(next.x - pt.x, next.z - pt.z);

            const rampWidth = Math.max(4, Math.min(pt.halfWidth * 2 * 0.7, pt.halfWidth * 2 - 1.6));
            const g = new THREE.Group();

            // ---- 本体のくさび ----
            const rampShape = new THREE.Shape();
            rampShape.moveTo(0, 0);
            rampShape.lineTo(RAMP_LEN, 0);
            rampShape.lineTo(RAMP_LEN, RAMP_HEIGHT);
            rampShape.lineTo(0, RAMP_HEIGHT * 0.3);
            rampShape.closePath();
            const rampGeo = new THREE.ExtrudeGeometry(rampShape, { steps: 1, depth: rampWidth, bevelEnabled: false });
            const rampMesh = new THREE.Mesh(
                rampGeo,
                new THREE.MeshPhongMaterial({ color: 0xffab00, emissive: 0x6b3d00, shininess: 30 })
            );
            rampMesh.position.set(0, 0, -rampWidth / 2);
            rampMesh.castShadow = true;
            rampMesh.receiveShadow = true;
            g.add(rampMesh);

            // ---- 傾斜面の矢印 ----
            const slopeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
            for (let a = 0; a < 4; a++) {
                const x = RAMP_LEN * (0.16 + a * 0.22) - 0.12 * Math.sin(slopeAngle);
                const yBase = RAMP_HEIGHT * 0.3 + (x / RAMP_LEN) * RAMP_HEIGHT * 0.7;
                const arrow = new THREE.Mesh(slopeGeo, slopeMat);
                arrow.position.set(x, yBase + 0.12 * Math.cos(slopeAngle), 0);
                arrow.rotation.z = slopeAngle - Math.PI / 2;   // 先端が上り方向を向く
                g.add(arrow);
            }

            // ---- 側面フェンス（赤白交互）----
            const railPieces = 6;
            for (const side of [-1, 1]) {
                for (let r = 0; r < railPieces; r++) {
                    const color = ((r + (side > 0 ? 0 : 1)) % 2 === 0) ? 0xff1744 : 0xffffff;
                    const rail = new THREE.Mesh(
                        new THREE.BoxGeometry(RAMP_LEN / railPieces - 0.08, RAMP_HEIGHT + 0.5, 0.35),
                        new THREE.MeshBasicMaterial({ color })
                    );
                    rail.position.set(
                        (r + 0.5) * (RAMP_LEN / railPieces),
                        (RAMP_HEIGHT + 0.5) / 2,
                        side * (rampWidth / 2 + 0.2)
                    );
                    rail.castShadow = true;
                    g.add(rail);
                }
            }

            // ---- 天端（テイクオフ縁）の発光バー ----
            const lipMat = new THREE.MeshBasicMaterial({ color: 0xffee58 });
            const lip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, rampWidth + 0.6), lipMat);
            lip.position.set(RAMP_LEN - 0.15, RAMP_HEIGHT + 0.12, 0);
            g.add(lip);

            // ---- 案内サイン（手前に立つ支柱付き看板）----
            const sign = new THREE.Group();
            const plate = new THREE.Mesh(
                new THREE.BoxGeometry(3.4, 2.1, 0.2),
                new THREE.MeshPhongMaterial({ color: 0x0d47a1, emissive: 0x00285c })
            );
            plate.castShadow = true;
            sign.add(plate);
            const signArrow = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
            signArrow.position.set(0, -0.35, 0.13);
            sign.add(signArrow);
            sign.rotation.y = -Math.PI / 2;          // 看板の面を進んできたカート側(local -X)へ
            sign.position.set(-2.0, SIGN_HEIGHT, 0);
            g.add(sign);

            const pole = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, SIGN_HEIGHT, 0.3),
                new THREE.MeshPhongMaterial({ color: 0x90a4ae, emissive: 0x2c3640 })
            );
            pole.position.set(-2.0, SIGN_HEIGHT / 2, 0);
            pole.castShadow = true;
            g.add(pole);

            g.position.set(pt.x, pt.y + 0.05, pt.z);
            // local +X を進行方向（丘の傾き込み）へ合わせる
            g.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), fwd);

            this.group.add(g);
            this.ramps.push({ x: pt.x, z: pt.z, y: pt.y, angle, rampHeight: RAMP_HEIGHT, mesh: g, sign, lipMat });
        }

        this.scene.add(this.group);   // ← シーンに登録（これが無いと表示されなかった）
    }

    /** サインを揺らし、天端バーを明滅させる */
    update(t) {
        for (const ramp of this.ramps) {
            if (!ramp.sign) continue;
            ramp.sign.position.y = SIGN_HEIGHT + 0.25 * Math.sin(t * 1.8);
            ramp.sign.rotation.z = 0.06 * Math.sin(t * 1.2);
            ramp.lipMat.color.setHSL(0.13, 1, 0.55 + 0.12 * Math.sin(t * 4));
        }
    }
}
