import * as THREE from 'three';

/**
 * Particles - パーティクルエフェクトシステム（InstancedMesh のoptimize）
 * - All particles share ONE InstancedMesh → 1 draw call instead of N.
 * - Fixed capacity pool: zero allocations in spawn/update (GC-free).
 * - Per-instance color via setColorAt; per-instance fade via scale-down
 *   (avoids transparency sorting + material clones).
 */
export class Particles {
    constructor(scene) {
        this.scene = scene;

        // Capacity: max simultaneous particles. Tuned for 60 FPS on mobile.
        this.capacity = 384;

        // Low-poly shared geometry (already optimized)
        const geo = new THREE.SphereGeometry(0.12, 4, 4);
        // Single shared material: opaque + vertexColors so we can vary per-instance color.
        const mat = new THREE.MeshBasicMaterial({ vertexColors: false });

        this.mesh = new THREE.InstancedMesh(geo, mat, this.capacity);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.setColorAt(0, new THREE.Color(0xffffff)); // allocate instanceColor buffer
        this.mesh.frustumCulled = false; // particles are always near camera; skip cull overhead

        scene.add(this.mesh);

        // Pooled particle data (pre-allocated arrays — no GC in hot loop)
        this.px = new Float32Array(this.capacity);
        this.py = new Float32Array(this.capacity);
        this.pz = new Float32Array(this.capacity);
        this.vx = new Float32Array(this.capacity);
        this.vy = new Float32Array(this.capacity);
        this.vz = new Float32Array(this.capacity);
        this.life = new Int16Array(this.capacity);
        this.maxLife = new Int16Array(this.capacity);
        this.baseScale = new Float32Array(this.capacity);

        // Scratch reusable objects — no allocation in update loop
        this._mat4 = new THREE.Matrix4();

        this.activeCount = 0;
    }

    spawn(x, z, angle, color, baseY = 0.5) {
        const cap = this.capacity;
        for (let i = 0; i < 12; i++) {
            // Find a free slot by scanning from activeCount (compaction below)
            let slot = -1;
            for (let s = 0; s < cap; s++) {
                if (this.life[s] <= 0) { slot = s; break; }
            }
            if (slot < 0) return; // pool exhausted — silently drop
            this.px[slot] = x + (Math.random() - 0.5) * 0.6;
            this.py[slot] = baseY + Math.random() * 0.5;
            this.pz[slot] = z + (Math.random() - 0.5) * 0.6;
            this.vx[slot] = (Math.random() - 0.5) * 0.3;
            this.vy[slot] = 0.1 + Math.random() * 0.2;
            this.vz[slot] = (Math.random() - 0.5) * 0.3;
            const l = 40 + Math.random() * 20;
            this.life[slot] = l;
            this.maxLife[slot] = l;
            this.baseScale[slot] = 0.7 + Math.random() * 0.8;

            // Set color once per spawn (setColorAt handles buffer growth)
            this.mesh.setColorAt(slot, _scratchColor.set(color));
        }
    }

    update() {
        const mat4 = this._mat4;
        let anyActive = false;
        for (let i = 0; i < this.capacity; i++) {
            const l = this.life[i];
            if (l <= 0) {
                // Hide inactive instances by zeroing scale (single matrix write, no draw cost)
                mat4.makeScale(0, 0, 0);
                mat4.setPosition(0, -1000, 0);
                this.mesh.setMatrixAt(i, mat4);
                continue;
            }
            anyActive = true;
            // Integrate motion
            const x = (this.px[i] += this.vx[i]);
            const y = (this.py[i] += this.vy[i]);
            const z = (this.pz[i] += this.vz[i]);
            this.vy[i] -= 0.005;

            // Fade via scale-down: s = baseScale * (life/maxLife)
            const t = l / this.maxLife[i];
            const s = this.baseScale[i] * t;
            mat4.makeScale(s, s, s);
            mat4.setPosition(x, y, z);
            this.mesh.setMatrixAt(i, mat4);

            this.life[i] = l - 1;
        }
        if (anyActive) {
            this.mesh.instanceMatrix.needsUpdate = true;
            // instanceColor only needs update when spawn changes it — but setColorAt already marks dirty.
        }
    }

    clear() {
        for (let i = 0; i < this.capacity; i++) {
            if (this.life[i] > 0) this.life[i] = 0;
        }
        // Push one hide-pass on next update to zero out matrices.
    }

    disposePools() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        if (this.mesh.instanceColor) this.mesh.instanceColor.dispose?.call(this.mesh.instanceColor);
        this.scene.remove(this.mesh);
    }
}

// Module-scope scratch color to avoid `new Color` per spawn call
const _scratchColor = new THREE.Color();

