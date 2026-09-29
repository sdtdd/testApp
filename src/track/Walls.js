/**
 * Walls - トラック縁に沿った外壁（バリアー）の生成
 * 高さはカート車体の高さの 70%。カート側の衝突判定は Kart._collideWalls() にある。
 */
import * as THREE from 'three';
import { disposeObject } from '../core/utils.js';
import { trackPath } from './TrackData.js';
import { WALL_HEIGHT, WALL_THICKNESS, WALL_INNER_OFFSET, WALL_BASE_DEPTH } from '../core/specs.js';

const THEME_COLORS = {
    grass: { body: 0xdfe4e8, stripe: 0xe53935, outer: 0x9aa3ab },
    mountain: { body: 0xc9d2da, stripe: 0xffb300, outer: 0x8a949d },
    desert: { body: 0xe6d3ad, stripe: 0xd84315, outer: 0xa8977a },
    stadium: { body: 0xeef1f5, stripe: 0x1565c0, outer: 0xb6bec8 }
};

export class Walls {
    constructor(scene) {
        this.scene = scene;
        this.group = null;
        this.info = { height: WALL_HEIGHT, sides: 0, quads: 0 };
    }

    dispose() {
        if (this.group) {
            this.scene.remove(this.group);
            disposeObject(this.group);
            this.group = null;
        }
    }

    build(theme = 'grass') {
        this.dispose();
        const colors = THEME_COLORS[theme] || THEME_COLORS.grass;
        this.group = new THREE.Group();
        let quads = 0;
        for (const side of [1, -1]) quads += this._buildSide(side, colors);
        this.scene.add(this.group);
        this.info = { height: WALL_HEIGHT, sides: 2, quads };
        return this.info;
    }

    /** 片側分の壁を 1 つの BufferGeometry として生成（描画コールを抑える） */
    _buildSide(side, colors) {
        const n = trackPath.length;
        const innerTop = [], innerBot = [], outerTop = [], outerBot = [];

        for (let i = 0; i < n; i++) {
            const p = trackPath[i];
            // 路面の右方向ベクトル（heading 基準）: (cos h, -sin h)
            const rx = Math.cos(p.heading), rz = -Math.sin(p.heading);
            const off = (p.halfWidth + WALL_INNER_OFFSET) * side;
            const ix = p.x + rx * off, iz = p.z + rz * off;
            const ox = ix + rx * WALL_THICKNESS * side, oz = iz + rz * WALL_THICKNESS * side;
            const top = p.y + WALL_HEIGHT, bot = p.y - WALL_BASE_DEPTH;
            innerTop.push({ x: ix, y: top, z: iz });
            innerBot.push({ x: ix, y: bot, z: iz });
            outerTop.push({ x: ox, y: top, z: oz });
            outerBot.push({ x: ox, y: bot, z: oz });
        }

        const cBody = new THREE.Color(colors.body);
        const cStripe = new THREE.Color(colors.stripe);
        const cOuter = new THREE.Color(colors.outer);
        const positions = [], normals = [], colorsArr = [], indices = [];
        let quads = 0;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const p = trackPath[i];
            const rx = Math.cos(p.heading), rz = -Math.sin(p.heading);
            const inward = { x: -rx * side, y: 0, z: -rz * side };   // トラック側を向く法線
            const outward = { x: rx * side, y: 0, z: rz * side };
            const up = { x: 0, y: 1, z: 0 };

            // 内側面（カートから見える面）
            addQuad(innerBot[i], innerTop[i], innerTop[j], innerBot[j], inward, cBody,
                positions, normals, colorsArr, indices);
            // 外側面
            addQuad(outerBot[i], outerTop[i], outerTop[j], outerBot[j], outward, cOuter,
                positions, normals, colorsArr, indices);
            // 天面（2区間ごとに市松模様の警戒色）
            const stripe = (Math.floor(i / 2) % 2 === 0) ? cStripe : cBody;
            addQuad(innerTop[i], outerTop[i], outerTop[j], innerTop[j], up, stripe,
                positions, normals, colorsArr, indices);
            quads += 3;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colorsArr, 3));
        geo.setIndex(indices);

        // Shader & Material Downgrading: MeshLambert instead of Standard (no PBR calc)
        const mat = new THREE.MeshLambertMaterial({
            vertexColors: true, side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = 'wall';
        this.group.add(mesh);
        return quads;
    }
}

/** 4点の四边形を追加し、desired 法線に向くように巻き方向を補正する */
function addQuad(a, b, c, d, desired, color, positions, normals, colorsArr, indices) {
    const base = positions.length / 3;
    for (const v of [a, b, c, d]) {
        positions.push(v.x, v.y, v.z);
        normals.push(desired.x, desired.y, desired.z);
        colorsArr.push(color.r, color.g, color.b);
    }
    const e1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const e2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const cx = e1.y * e2.z - e1.z * e2.y;
    const cy = e1.z * e2.x - e1.x * e2.z;
    const cz = e1.x * e2.y - e1.y * e2.x;
    const dot = cx * desired.x + cy * desired.y + cz * desired.z;
    if (dot >= 0) indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else indices.push(base, base + 3, base + 2, base, base + 2, base + 1);
}
