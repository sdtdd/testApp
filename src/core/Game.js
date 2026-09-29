import { trackPath } from '../track/TrackData.js';
import { Kart } from '../entities/Kart.js';
import { AIWorker } from './AIWorker.js';

const AI_NAMES = ['Luigi', 'Peach', 'Yoshi', 'Bowser'];
const AI_COLORS = [0x4caf50, 0xf48fb1, 0x66bb6a, 0xff7043];

/**
 * Game - レースゲームのオーケストレーター（ステートマシン、レースループ）
 */
export class Game {
    constructor(deps) {
        this.sceneSetup = deps.sceneSetup;
        this.scene = deps.scene;
        this.dashPads = deps.dashPads;
        this.jumpRamps = deps.jumpRamps;
        this.itemSystem = deps.itemSystem;
        this.particles = deps.particles;
        this.environment = deps.environment;
        this.inputManager = deps.inputManager;
        this.cameraController = deps.cameraController;
        this.hud = deps.hud;
        this.minimap = deps.minimap;

        this.state = 'menu'; // menu | countdown | racing | finished
        this.karts = [];
        this.countdownTimer = 0;
        this.raceStartTime = 0;
        this.frameCount = 0;
        this.wallToastTimer = 0;
        this._aiWorker = null; // Web Worker for AI computation offload
    }

    startRace() {
        for (const k of this.karts) k.dispose();
        this.karts = [];
        this.itemSystem.clear();
        this.particles.clear();

        const start = trackPath[0];
        const startAngle = start.heading;

        this.karts.push(new Kart(this.scene, start.x, start.z, startAngle, 0xe53935, 'YOU', true));

        for (let i = 0; i < AI_NAMES.length; i++) {
            const offset = (i - 1.5) * 2.8; // 横方向オフセット（左ベクトル = (cos a, -sin a)）
            const back = 4;                 // 進行方向の後方
            const nx = start.x + Math.cos(startAngle) * offset - Math.sin(startAngle) * back;
            const nz = start.z - Math.sin(startAngle) * offset - Math.cos(startAngle) * back;
            this.karts.push(new Kart(this.scene, nx, nz, startAngle, AI_COLORS[i], AI_NAMES[i], false));
        }

        // カメラをカートの真後ろに距離一定で配置（古い位置から飛ばさない）
        if (this.cameraController) this.cameraController.snapBehind(this.karts[0]);

        this.itemSystem.spawnItemBoxes();

        // Create AI worker for offloading kart path-finding to Web Worker
        if (this._aiWorker) this._aiWorker.dispose();
        const serializedPath = [];
        for (let i = 0; i < trackPath.length; i++) {
            const p = trackPath[i];
            serializedPath.push({ x: p.x, z: p.z, heading: p.heading });
        }
        this._aiWorker = new AIWorker(serializedPath);

        this.state = 'countdown';
        this.countdownTimer = 180;
        this.raceStartTime = performance.now();
    }

    update() {
        this.frameCount++;
        if (this.wallToastTimer > 0) this.wallToastTimer--;

        if (this.state === 'countdown') {
            this.countdownTimer--;
            const sec = Math.ceil(this.countdownTimer / 60);
            this.hud.showCountdown(sec > 0 ? String(sec) : 'GO!');
            if (this.countdownTimer <= 0) {
                this.state = 'racing';
                this.hud.hideCountdown();
            }
        }

        if (this.state === 'racing' || this.state === 'finished') {
            const playerInput = this.inputManager.getInput();

            // Collect AI kart states and post to worker for next-frame computation
            if (this._aiWorker) {
                const aiKarts = [];
                for (let i = 1; i < this.karts.length; i++) {
                    const k = this.karts[i];
                    if (!k.finished) aiKarts.push({ x: k.x, z: k.z, angle: k.angle, speed: k.speed, maxSpeed: k.maxSpeed });
                }
                if (aiKarts.length > 0) this._aiWorker.requestAIComputation(aiKarts);
            }

            // Read worker result from previous frame (or compute synchronously as fallback)
            let aiResults = null;
            if (this._aiWorker) {
                aiResults = this._aiWorker.getResult();
            }

            for (const kart of this.karts) {
                if (kart.finished && !kart.isPlayer) continue;
                if (kart.isPlayer) {
                    kart.update(playerInput);
                } else {
                    // Use worker result if available, otherwise synchronous fallback
                    const aiIdx = this.karts.indexOf(kart) - 1;
                    if (aiResults && aiIdx >= 0 && aiIdx < aiResults.length) {
                        kart.applyPrecomputedAI(aiResults[aiIdx]);
                    } else {
                        kart.updateAI();
                    }
                }
                this._checkDashPads(kart);
                this._checkJumpRamps(kart);
                this._checkHazardEffects(kart);
            }

            if (this.inputManager.isPressed('KeyE') && this.karts[0]) {
                this.itemSystem.useItem(this.karts[0]);
            }

            for (let i = 1; i < this.karts.length; i++) {
                if (this.karts[i].item && Math.random() < 0.01) {
                    this.itemSystem.useItem(this.karts[i]);
                }
            }

            this.itemSystem.update(this.karts);
            this.particles.update();
            this._checkFinish();
        }

        // Kart-to-kart collision (slight bounce + slight deceleration)
        if (this.state === 'racing' || this.state === 'finished') {
            this._collideKarts();
        }

        this.environment.updateClouds();

        if (this.karts[0]) {
            if (this.state === 'countdown') {
                this.cameraController.setCountdownCamera(this.karts[0]);
            } else {
                this.cameraController.update(this.karts[0]);
            }
            // 長いコースでも影が追いつくようにライトを追従させる
            this.sceneSetup.followKart(this.karts[0]);
        }

        if (this.karts[0]) {
            const position = this._getPlayerPosition();
            this.hud.update(this.karts[0], position, this.karts.length);
        }

        if (this.frameCount % 3 === 0 && this.karts.length > 0) {
            this.minimap.update(this.karts[0], this.karts);
        }
    }

    _checkDashPads(kart) {
        for (const pad of this.dashPads.pads) {
            const dx = kart.x - pad.x, dz = kart.z - pad.z;
            const dist2 = dx * dx + dz * dz;
            if (dist2 < 9.0 && kart.dashCooldown <= 0 && !kart.falling) { // 3.0^2 = 9.0
                kart.applyBoost(0.25);
                kart.dashCooldown = 60;
                if (kart.isPlayer) {
                    this.particles.spawn(pad.x, pad.z, pad.angle, 0x00e5ff, pad.y + 0.4);
                }
            }
        }
    }

    _checkJumpRamps(kart) {
        for (const ramp of this.jumpRamps.ramps) {
            const dx = kart.x - ramp.x, dz = kart.z - ramp.z;
            const dist2 = dx * dx + dz * dz;
            if (dist2 < 16.0 && !kart.airborne && !kart.falling && kart.dashCooldown <= 0) { // 4.0^2 = 16.0
                kart.applyJump(0.18 + Math.abs(kart.speed) * 0.15);
                kart.dashCooldown = 30;
                if (kart.isPlayer) {
                    this.particles.spawn(ramp.x, ramp.z, ramp.angle, 0xffab00, ramp.y + 1.2);
                }
            }
        }
    }

    /**
     * Kart-to-kart collision: when two karts overlap, push them slightly apart
     * and reduce both speeds. Always applies a small bounce regardless of speed.
     */
    _collideKarts() {
        const collideDist = 1.6; // kart body radius ~0.8 each side
        const n = this.karts.length;
        for (let i = 0; i < n; i++) {
            const a = this.karts[i];
            if (a.finished && !a.isPlayer) continue;
            for (let j = i + 1; j < n; j++) {
                const b = this.karts[j];
                if (b.finished && !b.isPlayer) continue;

                const dx = b.x - a.x;
                const dz = b.z - a.z;
                const dist2 = dx * dx + dz * dz;
                if (dist2 >= collideDist * collideDist) continue;
                if (a.airborne && b.airborne) continue; // both in air: no collision

                const dist = Math.sqrt(dist2) || 0.001;
                const overlap = collideDist - dist;
                const pushHalf = overlap * 0.5;

                // Collision normal (from a toward b)
                const nx = dx / dist;
                const nz = dz / dist;

                // Push each kart apart along the collision normal
                a.x -= nx * pushHalf;
                a.z -= nz * pushHalf;
                b.x += nx * pushHalf;
                b.z += nz * pushHalf;

                // Slight deceleration for both karts (speed-independent)
                a.speed *= 0.96;
                b.speed *= 0.96;

                // Slight angular kick to add bounce feel
                const kickAngle = Math.atan2(-nz, -nx); // away from partner
                let angleAdjA = kickAngle - a.angle;
                while (angleAdjA > Math.PI) angleAdjA -= Math.PI * 2;
                while (angleAdjA < -Math.PI) angleAdjA += Math.PI * 2;
                if (Math.abs(angleAdjA) < Math.PI * 0.6) {
                    a.angle += angleAdjA * 0.04; // subtle steer away
                }

                const kickAngleB = Math.atan2(nz, nx); // away from partner
                let angleAdjB = kickAngleB - b.angle;
                while (angleAdjB > Math.PI) angleAdjB -= Math.PI * 2;
                while (angleAdjB < -Math.PI) angleAdjB += Math.PI * 2;
                if (Math.abs(angleAdjB) < Math.PI * 0.6) {
                    b.angle += angleAdjB * 0.04; // subtle steer away
                }
            }
        }
    }


    /** 落とし穴・外壁・泥・ツルツル路面のエフェクトとメッセージ */
    _checkHazardEffects(kart) {
        if (kart.justFell) {
            kart.justFell = false;
            this.particles.spawn(kart.x, kart.z, kart.angle, 0x8d6e63, Math.max(kart.y, 0.3));
            if (kart.isPlayer) this.hud.showMessage('⚠️ 落とし穴に落ちた！');
        }
        // 外壁への衝突（跳ね返り + 減速）
        if (kart.justHitWall) {
            kart.justHitWall = false;
            const strong = kart.wallImpact > 0.65;
            this.particles.spawn(kart.x, kart.z, kart.angle, strong ? 0xffd54f : 0xbcaaa4, kart.y + 0.7);
            if (kart.isPlayer && this.wallToastTimer <= 0) {
                this.hud.showMessage(strong ? '💥 壁に激突！大きく減速' : '💨 壁を擦った！');
                this.wallToastTimer = 45;
            }
        }
        if (kart.isPlayer && kart.surface !== kart.prevSurface) {
            if (kart.surface === 'mud') this.hud.showMessage('🟤 泥でスピードダウン');
            else if (kart.surface === 'slick') this.hud.showMessage('❄️ ツルツル！ハンドル注意');
        }
        kart.prevSurface = kart.surface;
    }

    _getPlayerPosition() {
        // Cache: sort only once per frame, reuse result for HUD + finish check
        if (this._cachedPos !== undefined && this.frameCount === this._cachedFrame) return this._cachedPos;
        const player = this.karts[0];
        let rank = 1;
        for (let i = 1; i < this.karts.length; i++) {
            if (this.karts[i].getProgress() > player.getProgress()) rank++;
        }
        this._cachedPos = rank;
        this._cachedFrame = this.frameCount;
        return rank;
    }

    _checkFinish() {
        const player = this.karts[0];
        if (player.finished && this.state === 'racing') {
            this.state = 'finished';
            const elapsed = performance.now() - this.raceStartTime;
            const position = this._getPlayerPosition();
            this.hud.showFinish(position, elapsed);
        }
    }

    restart() {
        this.hud.hideFinish();
        this.startRace();
    }
}
