/**
 * DeviceTier - 画面のdevice capability のquality tier をdetect（high | medium | low）
 * Used by SceneSetup, Walls, and OcclusionCulling to scale rendering quality.
 *
 * Tier criteria:
 *   high:   Desktop GPU (dpr <= 2), no mobile UA flag → full effects
 *   medium: Mobile with dpr >= 1.5 or small viewport → reduce shadows/effects
 *   low:    Very low DPR / tiny screens / Safari on iOS → minimal rendering
 */

export class DeviceTier {
    constructor() {
        const ua = navigator.userAgent;
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isMobile = /Mobi|Android|iPhone/i.test(ua);

        if (isMobile && (dpr <= 1.5 || Math.min(w, h) < 600)) {
            this.tier = 'low';
        } else if (isMobile || dpr > 2) {
            this.tier = 'medium';
        } else {
            this.tier = 'high';
        }

        // Expose tier-based constants for downstream consumers
        this.shadowMapSize = this.tier === 'high' ? 2048 : this.tier === 'medium' ? 1024 : 512;
        this.maxPixelRatio = this.tier === 'low' ? 1.0 : Math.min(dpr, 2);
        this.enableShadows = this.tier !== 'low';
        this.shadowType = this.tier === 'high' ? 'PCFSoftShadowMap' : 'PCFShadowMap';
        this.enableToneMapping = this.tier === 'high';
        this.maxParticles = this.tier === 'high' ? 384 : this.tier === 'medium' ? 256 : 128;
    }

    /** Returns a string for CSS class / debug display */
    toString() { return this.tier; }
}
