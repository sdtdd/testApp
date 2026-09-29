import { SceneSetup } from './core/SceneSetup.js';
import { Game } from './core/Game.js';
import { TrackBuilder } from './track/TrackBuilder.js';
import { DashPads } from './track/DashPads.js';
import { JumpRamps } from './track/JumpRamps.js';
import { Hazards } from './track/Hazards.js';
import { Walls } from './track/Walls.js';
import { OcclusionCulling } from './core/OcclusionCulling.js';
import { Environment } from './environment/Environment.js';
import { Particles } from './effects/Particles.js';
import { InputManager } from './input/InputManager.js';
import { CameraController } from './ui/CameraController.js';
import { HUD } from './ui/HUD.js';
import { Minimap } from './ui/Minimap.js';
import { ItemSystem } from './items/ItemSystem.js';
import { courses, setCourse, trackPath } from './track/TrackData.js';

// --- Initialize core scene ---
const sceneSetup = new SceneSetup();
const scene = sceneSetup.scene;

// --- Builders（コース差し替えに対応） ---
const trackBuilder = new TrackBuilder(scene);
const dashPads = new DashPads(scene);
const jumpRamps = new JumpRamps(scene);
const hazards = new Hazards(scene);
const walls = new Walls(scene);
const environment = new Environment(scene);

// --- Occlusion Culling (skip rendering for objects hidden behind walls) ---
const occlusionCuller = new OcclusionCulling(scene, null);

// --- Systems ---
const particles = new Particles(scene);
const inputManager = new InputManager();
const cameraController = new CameraController(sceneSetup.camera);
const hud = new HUD();
const minimap = new Minimap();
const itemSystem = new ItemSystem(scene, particles);

// --- Game orchestrator ---
const game = new Game({
    sceneSetup,
    scene,
    dashPads,
    jumpRamps,
    itemSystem,
    particles,
    environment,
    inputManager,
    cameraController,
    hud,
    minimap,
});

// --- コースの読み込み（既存のトラックメッシュは破棄して再構築） ---
function applyCourse(index) {
    const info = setCourse(index);
    sceneSetup.setTheme(info.theme);
    trackBuilder.build();
    dashPads.build();
    jumpRamps.build();
    hazards.build();
    walls.build(info.theme.kind);
    environment.build(info.theme);

    // Register wall segments as occluders for hidden-object culling
    occlusionCuller.registerWallSegments(trackPath, (p) => p.halfWidth);

    // Add environment meshes as occlusion candidates
    occlusionCuller.clearCandidates();
    if (environment.group) {
        environment.group.traverse((child) => {
            if (child.isMesh && child.type !== 'InstancedMesh') {
                occlusionCuller.addCandidate(child);
            }
        });
    }

    return info;
}

// --- コース選択 UI ---
const courseListEl = document.getElementById('course-list');
let selectedCourse = 0;

function updateCourseHighlight() {
    if (!courseListEl) return;
    for (const el of courseListEl.querySelectorAll('.course-card')) {
        el.classList.toggle('selected', Number(el.dataset.index) === selectedCourse);
    }
}

function buildCourseButtons() {
    if (!courseListEl) return;
    courses.forEach((c, i) => {
        const card = document.createElement('button');
        card.className = 'course-card';
        card.dataset.index = String(i);
        card.innerHTML =
            `<strong>${c.name}</strong>` +
            `<span class="course-desc">${c.description}</span>` +
            `<span class="course-meta">🏁 ${c.laps}周 ・ 路面幅 ${c.width}m</span>`;
        card.addEventListener('click', () => {
            selectedCourse = i;
            updateCourseHighlight();
        });
        courseListEl.appendChild(card);
    });
    updateCourseHighlight();
}

buildCourseButtons();
applyCourse(0); // メニューの後ろに最初のコースを配置

function startSelectedCourse() {
    hud.hideStart();
    applyCourse(selectedCourse);
    game.startRace();
}

// --- UI button handlers ---
document.getElementById('start-btn').addEventListener('click', startSelectedCourse);

document.getElementById('restart-btn').addEventListener('click', () => {
    game.restart();
});

const courseBtn = document.getElementById('course-btn');
if (courseBtn) {
    courseBtn.addEventListener('click', () => {
        hud.hideFinish();
        hud.showStart();
        game.state = 'menu';
    });
}

// --- キーボード操作（メニュー中: 1〜3 でコース選択、Enter でスタート） ---
document.addEventListener('keydown', (e) => {
    if (game.state !== 'menu') return;
    if (e.code === 'Enter') { startSelectedCourse(); return; }
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m) {
        const idx = Number(m[1]) - 1;
        if (idx >= 0 && idx < courses.length) {
            selectedCourse = idx;
            updateCourseHighlight();
        }
    }
});

// --- Main loop ---
function animate() {
    requestAnimationFrame(animate);
    game.update();

    // ダッシュパッド／ジャンプ台は動くギミックとして常に見えやすくする
    const tSec = performance.now() * 0.001;
    dashPads.update(tSec);
    jumpRamps.update(tSec);

    // Occlusion culling: hide environment objects behind walls from camera POV
    const cam = sceneSetup.camera;
    occlusionCuller.update(cam.position.x, cam.position.z);

    sceneSetup.render();
}

animate();
