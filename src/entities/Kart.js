import * as THREE from 'three';
import { trackPath, waypoints, TOTAL_LAPS, nearestPathInfo, nearestPathIndex, shortcuts } from '../track/TrackData.js';
import { wallContactLimit } from '../core/specs.js';

/** 外壁との衝突パラメータ */
const WALL_RESTITUTION = 0.5;     // 反発係数（跳ね返りの強さ）
const WALL_HEADON_LOSS = 0.6;     // 正面衝突時の速度保持率（40%減）
const WALL_GLANCE_LOSS = 0.9;     // 擦っただけの時の速度保持率

/**
 * Kart - カートエンティティ（物理、AI、mesh生成）
 * 
 * Physics Simplification: Uses primitive sphere collider (KART_RADIUS from specs.js)
 * against track centerline distance — no mesh colliders, no physics engine needed.
 * All collision is analytical O(1): distance-from-centerline vs wall-contact-limit.
 * This avoids Rapier/Cannon overhead while maintaining accurate wall interaction.
 */
export class Kart {
    constructor(scene, x, z, angle, color, name, isPlayer = false) {
        this.scene = scene;
        this.x = x; this.z = z; this.angle = angle;
        this.y = nearestPathInfo(x, z).y;
        this.vy = 0;
        this.airborne = false;
        this.gravity = -0.012;
        this.color = color; this.name = name; this.isPlayer = isPlayer;
        this.speed = 0; this.maxSpeed = isPlayer ? 0.75 : 0.62;
        this.acceleration = 0.018; this.brakeForce = 0.025;
        this.friction = 0.975; this.offTrackFriction = 0.93;
        this.baseTurnSpeed = 0.045; this.turnSpeed = 0.045;
        this.isDrifting = false; this.driftAngle = 0;
        this.driftCharge = 0; this.driftBoost = 0;
        this.lap = 1; this.nextWaypointIndex = 1;
        this.finished = false; this.finishTime = 0;
        this.item = null; this.boostTimer = 0; this.slowTimer = 0;
        this.aiTargetIndex = 1;
        this.dashCooldown = 0;
        this.stallTimer = 0;
        // 路面状態（'road' | 'shortcut'）
        this.surface = 'road';
        this.onShortcut = false;
        // 外壁衝突の状態
        this.wallHits = 0;
        this.wallCooldown = 0;
        this.justHitWall = false;
        this.wallImpact = 0;
        this.trackIndex = nearestPathIndex(x, z); // 走行中のレイン（ Hairpin で別レインに吸われないため局所検索用）
        // GC-free reusable path-info scratch object (zero allocations in hot loop)
        this._li = { index: 0, dist: 0, cx: 0, cz: 0, halfWidth: 0 };
        this.mesh = this._createMesh();
        scene.add(this.mesh);
    }

    _createMesh() {
        const group = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(1.3, 0.5, 2.0);
        const bodyMat = new THREE.MeshPhongMaterial({ color: this.color, shininess: 60 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.45; body.castShadow = true;
        group.add(body);

        const noseGeo = new THREE.ConeGeometry(0.4, 0.6, 4);
        const nose = new THREE.Mesh(noseGeo, bodyMat);
        nose.position.set(0, 0.5, -1.3);
        nose.rotation.x = -Math.PI / 2; // tip points forward (local -Z)
        nose.castShadow = true;
        group.add(nose);

        const spoilerGeo = new THREE.BoxGeometry(1.4, 0.08, 0.3);
        const spoiler = new THREE.Mesh(spoilerGeo, bodyMat);
        spoiler.position.set(0, 0.95, 0.9);
        group.add(spoiler);
        const spoilerLegs = new THREE.BoxGeometry(0.08, 0.4, 0.08);
        for (const sx of [-0.55, 0.55]) {
            const leg = new THREE.Mesh(spoilerLegs, bodyMat);
            leg.position.set(sx, 0.72, 0.9);
            group.add(leg);
        }

        const driverGeo = new THREE.SphereGeometry(0.3, 10, 10);
        const driverMat = new THREE.MeshPhongMaterial({ color: 0xffe0b2 });
        const driver = new THREE.Mesh(driverGeo, driverMat);
        driver.position.y = 1.05; driver.castShadow = true;
        group.add(driver);

        const capGeo = new THREE.SphereGeometry(0.33, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
        const cap = new THREE.Mesh(capGeo, bodyMat);
        cap.position.y = 1.15; cap.castShadow = true;
        group.add(cap);

        const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 10);
        const wheelMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a });
        const rimGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.24, 8);
        const rimMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 80 });
        const positions = [[-0.75, 0.28, 0.65], [0.75, 0.28, 0.65], [-0.75, 0.28, -0.65], [0.75, 0.28, -0.65]];
        for (const pos of positions) {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(...pos);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            group.add(wheel);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.position.set(...pos);
            rim.rotation.z = Math.PI / 2;
            group.add(rim);
        }

        return group;
    }

    update(input) {
        const info = nearestPathInfo(this.x, this.z);
        const pt = info.point;
        this.onShortcut = !!info.onShortcut;
        this.surface = this.onShortcut ? 'shortcut' : (pt.surface || 'road');
        const onTrack = info.dist < pt.halfWidth + 1.2;

        const groundY = info.y;

        // ---- ドリフト ----
        if (input.drift && Math.abs(this.speed) > 0.25 && !this.airborne) {
            this.isDrifting = true;
            this.driftCharge = Math.min(this.driftCharge + 1, 90);
            this.turnSpeed = this.baseTurnSpeed * 1.8;
        } else {
            if (this.isDrifting && this.driftCharge > 25) {
                this.driftBoost = this.driftCharge / 30;
                this.boostTimer = Math.max(this.boostTimer, 20);
            }
            this.isDrifting = false;
            this.driftCharge = 0;
            this.turnSpeed = this.baseTurnSpeed;
        }

        // ---- Acceleration ----
        let maxSpd = this.maxSpeed;
        if (this.boostTimer > 0) { maxSpd *= 1.5; this.boostTimer--; }
        if (this.slowTimer > 0) { maxSpd *= 0.4; this.slowTimer--; }

        if (input.accelerate) this.speed += this.acceleration * (this.airborne ? 0.3 : 1);
        else if (input.brake) this.speed -= this.brakeForce;
        else this.speed *= onTrack ? this.friction : this.offTrackFriction;

        this.speed = Math.max(-maxSpd * 0.3, Math.min(maxSpd, this.speed));

        // ---- Turning ----
        // heading convention: forward = (sin(angle), cos(angle))
        // => increasing angle steers to the LEFT of the chase camera, decreasing steers right
        const steerSign = this.speed >= 0 ? 1 : -1; // steering inverts while reversing
        if (input.left) {
            if (this.isDrifting) this.driftAngle += this.turnSpeed;
            else this.angle += this.turnSpeed * steerSign;
        }
        if (input.right) {
            if (this.isDrifting) this.driftAngle -= this.turnSpeed;
            else this.angle -= this.turnSpeed * steerSign;
        }
        this.driftAngle *= 0.92;

        // ---- Movement ----
        const moveAngle = this.angle + this.driftAngle;
        this.x += Math.sin(moveAngle) * this.speed;
        this.z += Math.cos(moveAngle) * this.speed;

        // ---- 外壁との衝突（跳ね返り + 減速） ----
        if (this.wallCooldown > 0) this.wallCooldown--;
        this._collideWalls();

        // ---- Falling / Jump / gravity ----
        if (this.airborne) {
            this.vy += this.gravity;
            this.y += this.vy;
            if (this.y <= groundY) { this.y = groundY; this.airborne = false; this.vy = 0; }
        } else {
            this.y = groundY;
        }

        // Dash cooldown
        if (this.dashCooldown > 0) this.dashCooldown--;

        // Waypoint progression
        this._checkWaypoints();

        // Update mesh position
        this.mesh.position.set(this.x, this.y, this.z);
        const displayAngle = this.angle + this.driftAngle * 0.5;
        // the model's front is local -Z, so yaw must be heading + PI to face the travel direction
        this.mesh.rotation.y = displayAngle + Math.PI;

        // Drift visual tilt (lean into the turn)
        if (this.isDrifting) {
            this.mesh.rotation.z = this.driftAngle * 0.4;
            this.mesh.rotation.x *= 0.8;
        } else {
            this.mesh.rotation.z *= 0.85;
            this.mesh.rotation.x *= 0.8;
        }
    }

    /**
     * 走行中のレイン上の最寄り点を探す（線分への正投影で距離を測るため、
     * Hairpin の反対側レインに吸われたり、路面幅の変わり目で跳ね飛ばされない）。
     * ショートカット上ではショートカット経路上で局所検索する。
     */
    _localPathInfo() {
        // ショートカット上の場合：そのショートカット経路上で局所検索
        const g = nearestPathInfo(this.x, this.z);
        if (g.onShortcut) {
            const sc = shortcuts[g.shortcutIdx];
            const sp = sc.path;
            const sn = sp.length;
            let idx = g.index;
            const W = 8;
            // GC-free: reuse scratch fields instead of allocating objects per frame
            let bestDist = Infinity, bestIdx = -1, bestCx = 0, bestCz = 0;
            for (let k = -W; k <= W; k++) {
                const i = Math.max(0, Math.min(sn - 2, idx + k));
                const a = sp[i], b = sp[i + 1];
                const abx = b.x - a.x, abz = b.z - a.z;
                const len2 = abx * abx + abz * abz || 1;
                let t = ((this.x - a.x) * abx + (this.z - a.z) * abz) / len2;
                t = t < 0 ? 0 : (t > 1 ? 1 : t);
                const cx = a.x + abx * t, cz = a.z + abz * t;
                const dx = this.x - cx, dz = this.z - cz;
                const d = Math.sqrt(dx * dx + dz * dz);
                if (d < bestDist) { bestDist = d; bestIdx = i; bestCx = cx; bestCz = cz; }
            }
            if (bestIdx >= 0) {
                this.trackIndex = -1; // shortcut mode marker
                this._li.index = bestIdx;
                this._li.dist = bestDist;
                this._li.cx = bestCx;
                this._li.cz = bestCz;
                this._li.halfWidth = sc.width / 2;
                return this._li;
            }
        }

        const n = trackPath.length;
        const W = 12;
        // GC-free: reuse scratch fields instead of allocating objects per frame
        let bestDist = Infinity, bestIdx = -1, bestCx = 0, bestCz = 0, bestHW = 0;
        let altDist = Infinity, altIdx = -1, altCx = 0, altCz = 0, altHW = 0;
        const startIdx = this.trackIndex >= 0 ? this.trackIndex : g.index;
        for (let k = -W; k <= W; k++) {
            const i = (startIdx + k + n) % n;
            const a = trackPath[i], b = trackPath[(i + 1) % n];
            const abx = b.x - a.x, abz = b.z - a.z;
            const len2 = abx * abx + abz * abz || 1;
            let t = ((this.x - a.x) * abx + (this.z - a.z) * abz) / len2;
            t = t < 0 ? 0 : (t > 1 ? 1 : t);
            const cx = a.x + abx * t, cz = a.z + abz * t;
            const dx = this.x - cx, dz = this.z - cz;
            const d = Math.sqrt(dx * dx + dz * dz);
            const hw = a.halfWidth + (b.halfWidth - a.halfWidth) * t;
            if (d < altDist) { altDist = d; altIdx = i; altCx = cx; altCz = cz; altHW = hw; }
            let hd = this.angle - a.heading;
            while (hd > Math.PI) hd -= Math.PI * 2;
            while (hd < -Math.PI) hd += Math.PI * 2;
            if (Math.abs(hd) > 1.5) continue;      // 逆向きレイン（別走路）は候補から除外
            if (d < bestDist) { bestDist = d; bestIdx = i; bestCx = cx; bestCz = cz; bestHW = hw; }
        }
        const chosen = bestIdx >= 0 ? true : (altIdx >= 0);
        if (!chosen) {
            this.trackIndex = g.index;
            this._li.index = g.index;
            this._li.dist = g.dist;
            this._li.cx = g.point.x;
            this._li.cz = g.point.z;
            this._li.halfWidth = g.point.halfWidth;
            return this._li;
        }
        const useBest = bestIdx >= 0;
        const fIdx = useBest ? bestIdx : altIdx;
        const fDist = useBest ? bestDist : altDist;
        const fCx = useBest ? bestCx : altCx;
        const fCz = useBest ? bestCz : altCz;
        const fHW = useBest ? bestHW : altHW;
        this.trackIndex = fIdx;
        this._li.index = fIdx;
        this._li.dist = fDist;
        this._li.cx = fCx;
        this._li.cz = fCz;
        this._li.halfWidth = fHW;
        return this._li;
    }

    /**
     * 外壁との衝突処理。車体外側が壁の内面（路面端 + WALL_INNER_OFFSET）に接する
     * 位置を限界として内側へ押し戻し、速度の壁法線成分を反転（跳ね返り）して減速させる。
     * @returns {number} 衝突強度 0（非接触）〜1（正面衝突）
     */
    _collideWalls() {
        if (this.falling) return 0;
        const info = this._localPathInfo();
        const limit = wallContactLimit(info.halfWidth); // 車体が壁にちょうど接する位置
        if (info.dist <= limit) return 0;

        let nx = this.x - info.cx, nz = this.z - info.cz;
        const len = Math.hypot(nx, nz) || 1;
        nx /= len; nz /= len;                       // 壁へ向かう外側の法線

        // 位置を壁の内側（接触位置）へ戻す
        this.x = info.cx + nx * limit;
        this.z = info.cz + nz * limit;

        // 速度ベクトルを反射（壁に接したまま滑る接線成分は殺さない）
        const moveAngle = this.angle + this.driftAngle;
        let vx = Math.sin(moveAngle) * this.speed;
        let vz = Math.cos(moveAngle) * this.speed;
        const vlen = Math.hypot(vx, vz);
        const vn = vx * nx + vz * nz;               // 壁の法線方向の成分
        const impact = vlen > 1e-6 ? Math.abs(vn) / vlen : 0;

        if (vn > 0) {
            vx -= (1 + WALL_RESTITUTION) * vn * nx;
            vz -= (1 + WALL_RESTITUTION) * vn * nz;
        } else {
            const minPush = 0.04;
            vx -= minPush * nx;
            vz -= minPush * nz;
        }

        // 減速は衝撃を吸収した分だけ（連続接触で毎フレーム削るとスタックする）
        if (this.wallCooldown <= 0 && impact > 0.12) {
            const loss = WALL_HEADON_LOSS + (WALL_GLANCE_LOSS - WALL_HEADON_LOSS) * (1 - impact);
            vx *= loss; vz *= loss;
            this.wallCooldown = 18;
            this.justHitWall = impact > 0.3;
        } else {
            vx *= 0.96; vz *= 0.96;                // 壁を擦っている間の軽い抵抗
        }

        const newSpeed = Math.hypot(vx, vz);
        // 跳ね返り後の進行方向へ車向きを合わせる
        if (newSpeed > 0.02) {
            this.angle = Math.atan2(vx, vz);
            this.driftAngle = 0;
            this.isDrifting = false;
            this.driftCharge = 0;
        }
        this.speed = newSpeed;

        this.wallImpact = impact;
        this.wallHits++;
        return impact;
    }

    /** トラック外に逸脱したときの復帰 */
    _respawn() {
        const n = trackPath.length;
        const idx = nearestPathIndex(this.x, this.z);
        const pt = trackPath[idx];
        this.x = pt.x; this.z = pt.z; this.y = pt.y + 0.4;
        this.angle = pt.heading;
        this.driftAngle = 0;
        this.isDrifting = false;
        this.speed = 0.12;
        this.vy = 0;
        this.airborne = false;
        this.slowTimer = Math.max(this.slowTimer, 60);
        this.trackIndex = idx;
        this.mesh.rotation.set(0, this.angle + Math.PI, 0);
    }

    /**
     * Waypoint progression.
     * NOTE: `waypoints` (from TrackData/Courses) stores CENTERLINE PATH INDICES,
     * so they must be resolved through `trackPath` before reading .x/.z.
     * A kart that drives a shortcut physically skips the main-path waypoints in
     * between, so proximity alone would stall progression forever; the forward
     * path-index check covers that case as well.
     */
    _checkWaypoints() {
        const wpIdx = waypoints[this.nextWaypointIndex % waypoints.length];
        const target = trackPath[wpIdx];
        const dx = target.x - this.x, dz = target.z - this.z;
        let reached = dx * dx + dz * dz < 400; // within 20 units of the waypoint

        if (!reached) {
            // Already driven past this waypoint along the main path (shortcut cut).
            const n = trackPath.length;
            let cur = this.trackIndex;
            if (cur < 0) cur = nearestPathIndex(this.x, this.z);
            let fwd = cur - wpIdx;
            if (fwd < -n * 0.5) fwd += n;
            else if (fwd > n * 0.5) fwd -= n;
            reached = fwd > 0 && fwd < n * 0.25; // clearly ahead, not behind the line
        }

        if (!reached) return;

        this.nextWaypointIndex++;
        if (this.nextWaypointIndex > waypoints.length) {
            this.nextWaypointIndex = 1;
            this.lap++;
            if (this.lap > TOTAL_LAPS && !this.finished) {
                this.finished = true;
                this.finishTime = performance.now();
            }
        }
    }

    isOnTrack() {
        const info = nearestPathInfo(this.x, this.z);
        return info.dist < info.point.halfWidth + 1.2;
    }

    applyBoost(strength) {
        this.speed = Math.min(this.maxSpeed * 1.5, this.speed + strength);
        this.boostTimer = Math.max(this.boostTimer, 30);
    }

    applyJump(vy) {
        this.airborne = true;
        this.vy = vy;
    }

    applySlow(duration) {
        this.slowTimer = duration;
    }

    updateAI() {
        const n = trackPath.length;
        const info = nearestPathInfo(this.x, this.z);
        const near = info.index;

        // 前方の曲率から「見張り距離」と「安全速度」を決める（タイトなコーナーでは減速）
        let turn = trackPath[(near + 10) % n].heading - trackPath[(near + 4) % n].heading;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        const tightness = Math.min(1, Math.abs(turn) / 1.4);
        const safeSpeed = this.maxSpeed * (1 - 0.6 * tightness);
        const lookAhead = Math.max(3, 3 + Math.round((1 - tightness) * Math.abs(this.speed) * 9));

        const target = trackPath[(near + lookAhead) % n];
        const targetAngle = Math.atan2(target.x - this.x, target.z - this.z);

        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const input = { accelerate: true, brake: false, left: false, right: false, drift: false };
        // angleDiff > 0 means the target needs a larger heading -> steer left
        if (angleDiff > 0.1) input.left = true;
        else if (angleDiff < -0.1) input.right = true;

        if (Math.abs(this.speed) > safeSpeed) {
            input.brake = true;
            input.accelerate = false;
        } else if (Math.abs(angleDiff) > 0.7) {
            input.accelerate = false;
        }

        // 壁に接した（路面端に寄りすぎた）ときはセンターラインへ戻る操舵
        if (info.dist > wallContactLimit(info.point.halfWidth) - 0.2) {
            const ahead = trackPath[(near + 5) % n];
            let toTrack = Math.atan2(ahead.x - this.x, ahead.z - this.z) - this.angle;
            while (toTrack > Math.PI) toTrack -= Math.PI * 2;
            while (toTrack < -Math.PI) toTrack += Math.PI * 2;
            input.left = toTrack > 0.08;
            input.right = toTrack < -0.08;
            if (Math.abs(toTrack) > 1.3) {
                input.accelerate = false;
                input.brake = Math.abs(this.speed) > 0.2;
            }
        }

        // スタック対策：低速が続いたら強めに加速して抜け出す
        if (Math.abs(this.speed) < 0.12) this.stallTimer++; else this.stallTimer = 0;
        if (this.stallTimer > 60) {
            input.accelerate = true;
            input.brake = false;
        }

        this.update(input);
    }

    /**
     * applyPrecomputedAI - Apply steering/brake decisions from worker-computed data.
     * @param aiData: { angleDiff, safeSpeed } (from AIWorker.getResult or computeSync)
     * Still performs wall-avoidance locally since it needs nearestPathInfo (main-thread only).
     */
    applyPrecomputedAI(aiData) {
        const input = { accelerate: true, brake: false, left: false, right: false, drift: false };
        const angleDiff = aiData.angleDiff;
        const safeSpeed = aiData.safeSpeed;

        if (angleDiff > 0.1) input.left = true;
        else if (angleDiff < -0.1) input.right = true;

        if (Math.abs(this.speed) > safeSpeed) {
            input.brake = true;
            input.accelerate = false;
        } else if (Math.abs(angleDiff) > 0.7) {
            input.accelerate = false;
        }

        // Wall avoidance: check proximity to wall and steer back toward centerline
        const info = nearestPathInfo(this.x, this.z);
        const near = info.index;
        if (info.dist > wallContactLimit(info.point.halfWidth) - 0.2) {
            const n = trackPath.length;
            const ahead = trackPath[(near + 5) % n];
            let toTrack = Math.atan2(ahead.x - this.x, ahead.z - this.z) - this.angle;
            while (toTrack > Math.PI) toTrack -= Math.PI * 2;
            while (toTrack < -Math.PI) toTrack += Math.PI * 2;
            input.left = toTrack > 0.08;
            input.right = toTrack < -0.08;
            if (Math.abs(toTrack) > 1.3) {
                input.accelerate = false;
                input.brake = Math.abs(this.speed) > 0.2;
            }
        }

        // Stall recovery
        if (Math.abs(this.speed) < 0.12) this.stallTimer++; else this.stallTimer = 0;
        if (this.stallTimer > 60) {
            input.accelerate = true;
            input.brake = false;
        }

        this.update(input);
    }

    distToWaypoint() {
        const wp = trackPath[waypoints[(this.nextWaypointIndex - 1) % waypoints.length]];
        const dx = wp.x - this.x, dz = wp.z - this.z;
        return dx * dx + dz * dz; // squared distance (callers compare against threshold^2)
    }

    getProgress() {
        // 周回数 + 通過済みウェイポイント数（大きいほど先行）
        const passed = (this.lap - 1) * waypoints.length + (this.nextWaypointIndex - 1);
        return passed / (TOTAL_LAPS * waypoints.length);
    }

    dispose() {
        this.scene.remove(this.mesh);
    }
}
