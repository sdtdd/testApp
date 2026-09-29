import * as THREE from 'three';
import { DeviceTier } from './DeviceTier.js';

/**
 * SceneSetup - Three.js シーン、カメラ、レンダラー、ライトの初期化
 */
export class SceneSetup {
    constructor() {
        // --- Device-tier quality scaling (Post-Processing Restrictions) ---
        this.tier = new DeviceTier();

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x6ec6f5);
        this.scene.fog = new THREE.FogExp2(0x9ad4f7, 0.007);

        this.camera = new THREE.PerspectiveCamera(
            62,
            window.innerWidth / window.innerHeight,
            0.1,
            600
        );

        // Antialias only on high tier (expensive MSAA hurts mobile)
        const enableAA = this.tier.tier === 'high';
        this.renderer = new THREE.WebGLRenderer({ antialias: enableAA });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(this.tier.maxPixelRatio);

        // Shadow settings scaled by tier (disable on low-end)
        if (this.tier.enableShadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = this.tier.shadowType === 'PCFSoftShadowMap'
                ? THREE.PCFSoftShadowMap
                : THREE.PCFShadowMap;
        } else {
            this.renderer.shadowMap.enabled = false;
        }

        // Tone mapping: only high tier (ACES is a full-screen post-process)
        if (this.tier.enableToneMapping) {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.1;
        }

        document.getElementById('game-container').prepend(this.renderer.domElement);

        this._setupLights();
        this._setupGround();

        window.addEventListener('resize', () => this._onResize());
    }

    _setupLights() {
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3a7d2c, 0.6);
        this.hemiLight = hemiLight;
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
        dirLight.position.set(40, 80, 30);
        // Only cast shadows if tier allows (Post-Processing Restrictions)
        if (this.tier.enableShadows) {
            dirLight.castShadow = true;
            const shadowRes = this.tier.shadowMapSize;
            dirLight.shadow.mapSize.set(shadowRes, shadowRes);
        }
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 260;
        dirLight.shadow.camera.left = -75;
        dirLight.shadow.camera.right = 75;
        dirLight.shadow.camera.top = 75;
        dirLight.shadow.camera.bottom = -75;
        dirLight.target.position.set(0, 0, 0);
        this.scene.add(dirLight);
        this.scene.add(dirLight.target);
        this.dirLight = dirLight;

        // Removed fill light: hemisphere + directional is sufficient.
    }

    _setupGround() {
        const groundGeo = new THREE.PlaneGeometry(1600, 1600, 24, 24);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x3d9431 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.groundMat = groundMat;
    }

    /** コーステーマに合わせて空・霧・地面の色を変える */
    setTheme(theme) {
        if (!theme) return;
        if (this.scene.background) this.scene.background.setHex(theme.sky);
        else this.scene.background = new THREE.Color(theme.sky);
        this.scene.fog = new THREE.FogExp2(theme.fog, 0.0045);
        if (this.groundMat) this.groundMat.color.setHex(theme.ground);
    }

    /** 影のカバー範囲をカート付近に追従させる（長いコース用） */
    followKart(kart) {
        if (!this.dirLight || !kart) return;
        this.dirLight.position.set(kart.x + 40, 80, kart.z + 30);
        this.dirLight.target.position.set(kart.x, kart.y, kart.z);
        this.dirLight.target.updateMatrixWorld();
    }

    _onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
