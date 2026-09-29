/**
 * SpatialGrid - 轻量2D空间哈希の proximity queries を加速（O(1) average）
 * Replaces O(n) brute-force scans in TrackData, Game, ItemSystem.
 */

export class SpatialGrid {
    constructor(cellSize = 20) {
        this.cellSize = cellSize;
        this.invCell = 1 / cellSize;
        this.cells = new Map(); // key → array of entries
    }

    _key(cx, cy) {
        return cx * 73856093 ^ cy * 19349663; // hash combine (fast integer hash)
    }

    insert(x, z, data) {
        const cx = Math.floor(x * this.invCell);
        const cz = Math.floor(z * this.invCell);
        const k = this._key(cx, cz);
        let bucket = this.cells.get(k);
        if (!bucket) { bucket = []; this.cells.set(k, bucket); }
        bucket.push({ x, z, data });
    }

    /** Returns the closest entry to (x,z) within searchRadius. */
    nearest(x, z, searchRadius = 30) {
        const cx = Math.floor(x * this.invCell);
        const cz = Math.floor(z * this.invCell);
        const r = Math.ceil(searchRadius * this.invCell);
        let bestDist2 = Infinity;
        let bestEntry = null;

        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                const bucket = this.cells.get(this._key(cx + dx, cz + dy));
                if (!bucket) continue;
                for (const entry of bucket) {
                    const ex = x - entry.x, ez = z - entry.z;
                    const d2 = ex * ex + ez * ez;
                    if (d2 < bestDist2) { bestDist2 = d2; bestEntry = entry; }
                }
            }
        }
        return bestEntry ? { entry: bestEntry, dist2: bestDist2 } : null;
    }

    /** Returns all entries within radius of (x,z). */
    query(x, z, radius) {
        const results = [];
        const cx = Math.floor(x * this.invCell);
        const cz = Math.floor(z * this.invCell);
        const r = Math.ceil(radius * this.invCell);
        const r2 = radius * radius;

        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                const bucket = this.cells.get(this._key(cx + dx, cz + dy));
                if (!bucket) continue;
                for (const entry of bucket) {
                    const ex = x - entry.x, ez = z - entry.z;
                    if (ex * ex + ez * ez <= r2) results.push(entry);
                }
            }
        }
        return results;
    }

    clear() {
        this.cells.clear();
    }
}
