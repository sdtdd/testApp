import { trackPath, holes } from '../track/TrackData.js';

/**
 * Minimap - ミニマップ描画（Canvas 2D / コースの大きさに合わせて自動スケール）
 */
export class Minimap {
    constructor() {
        this.canvas = document.getElementById('minimap');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.pathRef = null;
        this.scale = 0.18;
        this.offX = 0;
        this.offZ = 0;
    }

    _fit() {
        if (this.pathRef === trackPath) return;
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const p of trackPath) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.z < minZ) minZ = p.z;
            if (p.z > maxZ) maxZ = p.z;
        }
        const w = this.canvas.width, h = this.canvas.height;
        const spanX = Math.max(1, maxX - minX), spanZ = Math.max(1, maxZ - minZ);
        this.scale = Math.min((w - 14) / spanX, (h - 14) / spanZ);
        this.offX = (w - spanX * this.scale) / 2 - minX * this.scale;
        this.offZ = (h - spanZ * this.scale) / 2 - minZ * this.scale;
        this.pathRef = trackPath;
    }

    _sx(x) { return x * this.scale + this.offX; }
    _sz(z) { return z * this.scale + this.offZ; }

    update(playerKart, allKarts) {
        if (!this.ctx) return;
        this._fit();
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        // トラック
        ctx.beginPath();
        ctx.strokeStyle = '#6f6f6f';
        ctx.lineWidth = Math.max(2.5, 14 * this.scale);
        ctx.lineJoin = 'round';
        for (let i = 0; i < trackPath.length; i++) {
            const pt = trackPath[i];
            const sx = this._sx(pt.x), sy = this._sz(pt.z);
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.stroke();

        // スタートライン
        const s = trackPath[0];
        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.moveTo(this._sx(s.x) - 4, this._sz(s.z) - 4);
        ctx.lineTo(this._sx(s.x) + 4, this._sz(s.z) + 4);
        ctx.stroke();

        // 落とし穴
        ctx.fillStyle = '#ff5252';
        for (const hole of holes) {
            ctx.beginPath();
            ctx.arc(this._sx(hole.x), this._sz(hole.z), Math.max(1.6, hole.radius * this.scale), 0, Math.PI * 2);
            ctx.fill();
        }

        // カート
        for (const kart of allKarts) {
            const sx = this._sx(kart.x), sy = this._sz(kart.z);
            ctx.beginPath();
            ctx.arc(sx, sy, kart.isPlayer ? 4 : 3, 0, Math.PI * 2);
            ctx.fillStyle = '#' + kart.color.toString(16).padStart(6, '0');
            ctx.fill();
            if (kart.isPlayer) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }
}
