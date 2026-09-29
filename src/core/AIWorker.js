/**
 * AIWorker - Web Worker でoffload AI pathfinding のheavy CPU work
 * 
 * Strategy:
 *   1. Main thread posts kart state snapshots to the worker (postMessage)
 *   2. Worker computes optimal waypoints / curvature analysis off-thread
 *   3. Result is posted back; main thread reads it on next frame (double-buffered)
 * 
 * This keeps the main render loop at 60fps even when AI calculations spike,
 * because the expensive pathfinding/procedural-gen never blocks rAF.
 */

export class AIWorker {
    constructor(trackData) {
        this.trackData = trackData; // serialized waypoints + headings
        this.worker = null;
        this.resultBuffer = null;   // double-buffered result from worker
        this._createWorker();
    }

    _createWorker() {
        try {
            const src = `
                onmessage = function(e) {
                    const { karts, trackPath } = e.data;
                    const results = [];
                    for (const kart of karts) {
                        const n = trackPath.length;
                        let near = 0, bestD2 = Infinity;
                        for (let i = 0; i < n; i++) {
                            const dx = kart.x - trackPath[i].x;
                            const dz = kart.z - trackPath[i].z;
                            const d2 = dx*dx + dz*dz;
                            if (d2 < bestD2) { bestD2 = d2; near = i; }
                        }
                        let turn = trackPath[(near+10)%n].heading - trackPath[(near+4)%n].heading;
                        while (turn > Math.PI) turn -= Math.PI*2;
                        while (turn < -Math.PI) turn += Math.PI*2;
                        const tightness = Math.min(1, Math.abs(turn)/1.4);
                        const safeSpeed = kart.maxSpeed * (1 - 0.6*tightness);
                        const lookAhead = Math.max(3, 3 + Math.round((1-tightness)*Math.abs(kart.speed)*9));
                        const targetIdx = (near + lookAhead) % n;
                        const target = trackPath[targetIdx];
                        const targetAngle = Math.atan2(target.x - kart.x, target.z - kart.z);
                        let angleDiff = targetAngle - kart.angle;
                        while (angleDiff > Math.PI) angleDiff -= Math.PI*2;
                        while (angleDiff < -Math.PI) angleDiff += Math.PI*2;
                        results.push({ near, lookAhead, targetIdx, targetAngle, angleDiff, tightness, safeSpeed });
                    }
                    postMessage(results);
                };
            `;
            this.worker = new Worker(URL.createObjectURL(
                new Blob([src], { type: 'application/javascript' })
            ));
            this.worker.addEventListener('message', (e) => {
                this.resultBuffer = e.data;
            });
        } catch (_e) {
            this.worker = null; // Workers unavailable — fallback to sync
        }
    }

    /**
     * Post AI computation request. Non-blocking: sends kart states + track data
     * to worker for next-frame retrieval.
     * @param karts: array of { x, z, angle, speed, maxSpeed } (plain objects)
     */
    requestAIComputation(karts) {
        if (!this.worker) return null; // caller must use computeSync fallback
        const payload = {
            karts: karts.map(k => ({ x: k.x, z: k.z, angle: k.angle, speed: k.speed, maxSpeed: k.maxSpeed })),
            trackPath: this.trackData,
        };
        this.worker.postMessage(payload);
        return true;
    }

    /** Retrieve the latest result (null if not yet available) */
    getResult() {
        const r = this.resultBuffer;
        this.resultBuffer = null; // consume (double-buffer swap)
        return r;
    }

    /** Synchronous fallback for environments without Worker support */
    computeSync(karts) {
        const trackPath = this.trackData;
        const n = trackPath.length;
        const results = [];
        for (const kart of karts) {
            let near = 0, bestD2 = Infinity;
            for (let i = 0; i < n; i++) {
                const dx = kart.x - trackPath[i].x;
                const dz = kart.z - trackPath[i].z;
                const d2 = dx * dx + dz * dz;
                if (d2 < bestD2) { bestD2 = d2; near = i; }
            }
            let turn = trackPath[(near+10)%n].heading - trackPath[(near+4)%n].heading;
            while (turn > Math.PI) turn -= Math.PI * 2;
            while (turn < -Math.PI) turn += Math.PI * 2;
            const tightness = Math.min(1, Math.abs(turn) / 1.4);
            const safeSpeed = kart.maxSpeed * (1 - 0.6 * tightness);
            const lookAhead = Math.max(3, 3 + Math.round((1 - tightness) * Math.abs(kart.speed) * 9));
            const targetIdx = (near + lookAhead) % n;
            const target = trackPath[targetIdx];
            const targetAngle = Math.atan2(target.x - kart.x, target.z - kart.z);
            let angleDiff = targetAngle - kart.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            results.push({ near, lookAhead, targetIdx, targetAngle, angleDiff, tightness, safeSpeed });
        }
        return results;
    }

    dispose() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}