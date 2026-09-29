import * as THREE from 'three';

/**
 * CameraController - チイスカメラ（カートとの距離は常に一定）
 *
 * カメラ位置 = カート位置 + 固定オフセット（回転のみスムージング）
 * → オフセットの大きさが変わらないため、カートとカメラの距離は常に一定。
 */
const CAM_DIST = 11;      // カートとの水平距離（固定）
const CAM_HEIGHT = 5.2;   // カートに対する高さ（固定）
const LOOK_AHEAD = 6;     // 注視点を前方にずらす距離（固定）

export class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.smoothAngle = 0;
        this.lookTarget = new THREE.Vector3(0, 1.5, 0);
        this.initialized = false;
    }

    /** 指定角度の真後ろに距離一定で配置（レース開始・リスタート用） */
    snapBehind(kart) {
        this.smoothAngle = kart.angle;
        this._place(kart, this.smoothAngle);
        const fx = Math.sin(this.smoothAngle), fz = Math.cos(this.smoothAngle);
        this.lookTarget.set(kart.x + fx * LOOK_AHEAD, kart.y + 1.6, kart.z + fz * LOOK_AHEAD);
        this.camera.lookAt(this.lookTarget);
        this.initialized = true;
    }

    _place(kart, angle) {
        const fx = Math.sin(angle), fz = Math.cos(angle);
        // forward の逆方向 = カートの真後ろ（距離は CAM_DIST / CAM_HEIGHT で固定）
        this.camera.position.set(
            kart.x - fx * CAM_DIST,
            kart.y + CAM_HEIGHT,
            kart.z - fz * CAM_DIST
        );
    }

    update(kart) {
        if (!this.initialized) { this.snapBehind(kart); return; }

        // 角度だけを滑らかに補間する（位置を補間すると距離が変動する）
        let diff = kart.angle - this.smoothAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.smoothAngle += diff * 0.12;

        this._place(kart, this.smoothAngle);

        const fx = Math.sin(this.smoothAngle), fz = Math.cos(this.smoothAngle);
        const target = new THREE.Vector3(
            kart.x + fx * LOOK_AHEAD,
            kart.y + 1.6,
            kart.z + fz * LOOK_AHEAD
        );
        this.lookTarget.lerp(target, 0.2);
        this.camera.lookAt(this.lookTarget);
    }

    /** カウントダウン中も同じ距離で背後から（GO! で距離が変わらない） */
    setCountdownCamera(kart) {
        this._place(kart, kart.angle);
        const fx = Math.sin(kart.angle), fz = Math.cos(kart.angle);
        this.lookTarget.set(kart.x + fx * 2.5, kart.y + 1.3, kart.z + fz * 2.5);
        this.camera.lookAt(this.lookTarget);
        this.smoothAngle = kart.angle;
        this.initialized = true;
    }
}
