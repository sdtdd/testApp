/**
 * TrackData - 現在選択中のコースのトラックデータ（live bindings）
 * setCourse(index) を呼ぶと全エクスポートが新しいコースに差し替わる。
 */
import { COURSES, buildCourse } from './Courses.js';
import { SpatialGrid } from '../core/SpatialGrid.js';

export const courses = COURSES.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    laps: c.laps,
    width: c.width,
    theme: c.theme
}));

let built = buildCourse(COURSES[0]);

export let courseIndex = 0;
export let currentCourse = courses[0];
export let trackTheme = built.theme;
export let trackPath = built.path;
export let waypoints = built.waypoints;
export let holes = built.holes;
export let dashPadIndices = built.dashPadIndices;
export let jumpRampIndices = built.jumpRampIndices;
export let shortcutEntryIndices = built.shortcutEntryIndices;
export let shortcuts = built.shortcuts;
export let TRACK_WIDTH = built.width;
export let TOTAL_LAPS = built.laps;
export let trackBounds = built.bounds;
export let trackLength = built.length;

/** lanePaint（raw の course definition の fraction range・other courses may not have it） */
export let lanePaintSections = COURSES[0].lanePaint ?? [];

// --- spatial grid for fast nearest-point lookup (rebuilt on course change) ---
let pathGrid;
let shortcutGrids;

function _rebuildGrids() {
    const cellSize = Math.max(10, trackLength / trackPath.length * 2);
    pathGrid = new SpatialGrid(cellSize);
    for (let i = 0; i < trackPath.length; i++) {
        pathGrid.insert(trackPath[i].x, trackPath[i].z, i);
    }
    shortcutGrids = [];
    for (let si = 0; si < shortcuts.length; si++) {
        const g = new SpatialGrid(cellSize);
        for (let i = 0; i < shortcuts[si].path.length; i++) {
            g.insert(shortcuts[si].path[i].x, shortcuts[si].path[i].z, i);
        }
        shortcutGrids.push(g);
    }
}
_rebuildGrids();

export function setCourse(index) {
    const total = COURSES.length;
    const i = ((index % total) + total) % total;
    built = buildCourse(COURSES[i]);
    courseIndex = i;
    currentCourse = courses[i];
    trackTheme = built.theme;
    trackPath = built.path;
    waypoints = built.waypoints;
    holes = built.holes;
    dashPadIndices = built.dashPadIndices;
    jumpRampIndices = built.jumpRampIndices;
    shortcutEntryIndices = built.shortcutEntryIndices;
    shortcuts = built.shortcuts;
    TRACK_WIDTH = built.width;
    TOTAL_LAPS = built.laps;
    trackBounds = built.bounds;
    trackLength = built.length;
    lanePaintSections = COURSES[i].lanePaint ?? [];
    _rebuildGrids();
    return currentCourse;
}

/** 最寄りセンターライン点の情報（メイントラック + ショートカット考慮、高さ補間つき） */
const _pathInfoCache = { index: 0, point: null, dist: 0, y: 0, onShortcut: false, shortcutIdx: -1 };

export function nearestPathInfo(x, z) {
    const n = trackPath.length;
    let bi = 0, bd = Infinity;

    // --- main path: O(1) average via spatial hash ---
    const hit = pathGrid.nearest(x, z, 40);
    if (hit) {
        bi = hit.entry.data;
        bd = hit.dist2;
    } else {
        // fallback: expand search radius once
        const hit2 = pathGrid.nearest(x, z, 120);
        if (hit2) { bi = hit2.entry.data; bd = hit2.dist2; }
    }

    // --- shortcuts check (fewer points, still grid-accelerated) ---
    let bestShortcutIdx = -1;
    let bestShortcutDist = bd;
    let bestShortcutPointIdx = 0;
    for (let si = 0; si < shortcutGrids.length; si++) {
        const shHit = shortcutGrids[si].nearest(x, z, 40);
        if (shHit && shHit.dist2 < bestShortcutDist) {
            bestShortcutDist = shHit.dist2;
            bestShortcutIdx = si;
            bestShortcutPointIdx = shHit.entry.data;
        }
    }

    if (bestShortcutIdx >= 0) {
        const sc = shortcuts[bestShortcutIdx];
        const sp = sc.path;
        const sn = sp.length;
        const p = sp[bestShortcutPointIdx];
        const ahead = (x - p.x) * Math.sin(p.heading) + (z - p.z) * Math.cos(p.heading);
        const nextIdx = ahead >= 0 ? Math.min(bestShortcutPointIdx + 1, sn - 1) : Math.max(bestShortcutPointIdx - 1, 0);
        const q = sp[nextIdx];
        const vx = q.x - p.x, vz = q.z - p.z;
        const len2 = vx * vx + vz * vz || 1;
        let t = ((x - p.x) * vx + (z - p.z) * vz) / len2;
        t = Math.max(0, Math.min(1, t));
        _pathInfoCache.index = bestShortcutPointIdx;
        _pathInfoCache.point = p;
        _pathInfoCache.dist = Math.sqrt(bestShortcutDist);
        _pathInfoCache.y = p.y + (q.y - p.y) * t;
        _pathInfoCache.onShortcut = true;
        _pathInfoCache.shortcutIdx = bestShortcutIdx;
        return _pathInfoCache;
    }

    const p = trackPath[bi];
    const ahead = (x - p.x) * Math.sin(p.heading) + (z - p.z) * Math.cos(p.heading);
    const q = trackPath[ahead >= 0 ? (bi + 1) % n : (bi - 1 + n) % n];
    const vx = q.x - p.x, vz = q.z - p.z;
    const len2 = vx * vx + vz * vz || 1;
    let t = ((x - p.x) * vx + (z - p.z) * vz) / len2;
    t = Math.max(0, Math.min(1, t));
    _pathInfoCache.index = bi;
    _pathInfoCache.point = p;
    _pathInfoCache.dist = Math.sqrt(bd);
    _pathInfoCache.y = p.y + (q.y - p.y) * t;
    _pathInfoCache.onShortcut = false;
    _pathInfoCache.shortcutIdx = -1;
    return _pathInfoCache;
}

export function nearestPathIndex(x, z) {
    return nearestPathInfo(x, z).index;
}

export function getGroundHeight(x, z) {
    return nearestPathInfo(x, z).y;
}

/** 'road' | 'shortcut'（hazard なし） */
export function surfaceAt(x, z) {
    const info = nearestPathInfo(x, z);
    if (info.onShortcut) return 'shortcut';
    return info.point.surface || 'road';
}

/** 指定位置を落としている穴（常に null：hazard なし） */
export function holeAt(_x, _z) {
    return null;
}
