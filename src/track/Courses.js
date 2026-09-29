/**
 * Courses - コース定義（3パターン）とトラックデータ生成
 *
 * 各コースは極座標関数 radius(theta) で「自己交差しない閉曲線」を定義する。
 * 単一値の r(theta) は必ず単純閉曲線になるため、ルートが交差せずレイアウトが安全。
 * Catmull-Rom で滑らかにサンプリングし、一定間隔で再サンプルしたセンターラインを作る。
 */

const PATH_SPACING = 4; // センターラインの点間隔（ユニット）

/** 局所的な半径の凹み（ヘアピン生成用のガウスノッチ） */
function notch(t, center, depth, width) {
    let d = t - center;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return -depth * Math.exp(-(d * d) / (2 * width * width));
}

export const COURSES = [
    {
        id: 'green',
        name: 'グリーンリンク・サーキット',
        description: '長大ストレート／シケイン／ヘアピンを持つ超長距離サーキット（複雑版）',
        laps: 3,
        width: 17,
        controlSamples: 180,
        radius: (t) => 1152 + 234 * Math.sin(3 * t + 0.5) + 81 * Math.cos(6 * t) + 54 * Math.sin(9 * t + 1.2)
            + 42 * Math.cos(12 * t + 0.7) + 36 * Math.sin(15 * t - 0.3)
            + notch(t, 1.95, 234, 0.24) + notch(t, 4.1, 180, 0.2)
            + notch(t, 3.2, 198, 0.22) + notch(t, 5.8, 216, 0.2) + notch(t, 0.6, 150, 0.18),
        hills: [
            { frac: 0.10, half: 0.06, amp: 16 },
            { frac: 0.24, half: 0.05, amp: -14 },
            { frac: 0.35, half: 0.05, amp: -12 },
            { frac: 0.48, half: 0.06, amp: 22 },
            { frac: 0.58, half: 0.04, amp: -18 },
            { frac: 0.67, half: 0.05, amp: 24 },
            { frac: 0.78, half: 0.06, amp: 20 },
            { frac: 0.88, half: 0.05, amp: -16 },
            { frac: 0.95, half: 0.04, amp: 10 }
        ],
        narrow: [
            { from: 0.20, to: 0.25, width: 10 },
            { from: 0.33, to: 0.40, width: 11 },
            { from: 0.52, to: 0.56, width: 9 },
            { from: 0.65, to: 0.70, width: 12 },
            { from: 0.82, to: 0.86, width: 10 }
        ],
        dash: [0.04, 0.12, 0.19, 0.30, 0.42, 0.50, 0.57, 0.63, 0.72, 0.81, 0.89, 0.96],
        jumps: [0.09, 0.16, 0.28, 0.40, 0.53, 0.61, 0.75, 0.84, 0.93],
        shortcuts: [
            { entryFrac: 0.18, exitFrac: 0.36, inwardDepth: 340, width: 14, elevation: 10 },
            { entryFrac: 0.50, exitFrac: 0.70, inwardDepth: 290, width: 12, elevation: 8 },
            { entryFrac: 0.76, exitFrac: 0.92, inwardDepth: 260, width: 13, elevation: 7 }
        ],
        theme: {
            kind: 'grass', ground: 0x3d9431, sky: 0x6ec6f5, fog: 0x9ad4f7,
            road: 0x4a4a4a, shortcut: 0x2e8b57, curbA: 0xff2222, curbB: 0xffffff
        }
    },
    {
        id: 'mountain',
        name: 'マウンテンパイク',
        description: '激しいアップダウンと長大直線、狭い山道区間の超長距離コース（複雑版）',
        laps: 2,
        width: 15,
        controlSamples: 180,
        radius: (t) => 1080 + 378 * Math.cos(2 * t) + 144 * Math.sin(4 * t + 1.0) + 72 * Math.cos(7 * t)
            + 90 * Math.sin(9 * t + 0.6) + 54 * Math.cos(11 * t - 0.8) + 36 * Math.sin(13 * t + 0.4)
            + notch(t, 4.3, 270, 0.22) + notch(t, 1.2, 200, 0.18)
            + notch(t, 2.5, 234, 0.2) + notch(t, 5.6, 198, 0.19) + notch(t, 0.4, 180, 0.17),
        hills: [
            { frac: 0.10, half: 0.05, amp: 34 },
            { frac: 0.22, half: 0.06, amp: -26 },
            { frac: 0.34, half: 0.06, amp: -32 },
            { frac: 0.45, half: 0.05, amp: 38 },
            { frac: 0.55, half: 0.07, amp: -28 },
            { frac: 0.65, half: 0.05, amp: 42 },
            { frac: 0.75, half: 0.06, amp: 30 },
            { frac: 0.85, half: 0.05, amp: -34 },
            { frac: 0.94, half: 0.04, amp: 18 }
        ],
        narrow: [
            { from: 0.14, to: 0.20, width: 9 },
            { from: 0.30, to: 0.35, width: 10 },
            { from: 0.48, to: 0.53, width: 9 },
            { from: 0.62, to: 0.66, width: 10 },
            { from: 0.74, to: 0.80, width: 9 },
            { from: 0.88, to: 0.92, width: 10 }
        ],
        dash: [0.04, 0.13, 0.22, 0.33, 0.41, 0.50, 0.57, 0.68, 0.77, 0.85, 0.93],
        jumps: [0.08, 0.18, 0.27, 0.38, 0.48, 0.58, 0.67, 0.74, 0.83, 0.92],
        shortcuts: [
            { entryFrac: 0.28, exitFrac: 0.46, inwardDepth: 360, width: 12, elevation: 12 },
            { entryFrac: 0.55, exitFrac: 0.72, inwardDepth: 320, width: 11, elevation: 10 },
            { entryFrac: 0.80, exitFrac: 0.96, inwardDepth: 280, width: 12, elevation: 9 }
        ],
        theme: {
            kind: 'mountain', ground: 0x4d6b3a, sky: 0xa8cbe6, fog: 0xc3dcee,
            road: 0x5c5c5c, shortcut: 0x4a7c3f, curbA: 0xffc107, curbB: 0x222222
        }
    },
    {
        id: 'desert',
        name: 'デザートツイスター',
        description: '狭い路面・連続ヘアピンの上級者向け超長距離コース（複雑版）',
        laps: 2,
        width: 13,
        controlSamples: 180,
        radius: (t) => 1098 + 252 * Math.sin(5 * t) + 108 * Math.cos(7 * t + 0.4) + 60 * Math.sin(11 * t)
            + 72 * Math.cos(13 * t + 0.2) + 48 * Math.sin(17 * t) + 30 * Math.cos(19 * t - 0.5)
            + notch(t, 0.95, 198, 0.2) + notch(t, 3.6, 216, 0.2) + notch(t, 5.5, 160, 0.18)
            + notch(t, 2.1, 180, 0.19) + notch(t, 4.8, 200, 0.17) + notch(t, 1.5, 150, 0.16),
        hills: [
            { frac: 0.12, half: 0.05, amp: 18 },
            { frac: 0.25, half: 0.05, amp: -16 },
            { frac: 0.38, half: 0.06, amp: 14 },
            { frac: 0.50, half: 0.05, amp: -20 },
            { frac: 0.60, half: 0.05, amp: 22 },
            { frac: 0.72, half: 0.06, amp: -18 },
            { frac: 0.84, half: 0.05, amp: 20 },
            { frac: 0.93, half: 0.04, amp: -12 }
        ],
        narrow: [
            { from: 0.15, to: 0.21, width: 8 },
            { from: 0.32, to: 0.37, width: 9 },
            { from: 0.45, to: 0.52, width: 8 },
            { from: 0.60, to: 0.65, width: 9 },
            { from: 0.72, to: 0.78, width: 8 },
            { from: 0.85, to: 0.90, width: 9 }
        ],
        dash: [0.03, 0.10, 0.17, 0.26, 0.34, 0.43, 0.52, 0.58, 0.66, 0.74, 0.82, 0.91],
        jumps: [0.07, 0.15, 0.24, 0.33, 0.44, 0.55, 0.63, 0.71, 0.79, 0.88, 0.95],
        shortcuts: [
            { entryFrac: 0.22, exitFrac: 0.40, inwardDepth: 310, width: 11, elevation: 9 },
            { entryFrac: 0.48, exitFrac: 0.65, inwardDepth: 330, width: 12, elevation: 11 },
            { entryFrac: 0.72, exitFrac: 0.90, inwardDepth: 290, width: 11, elevation: 8 }
        ],
        theme: {
            kind: 'desert', ground: 0xd9b98a, sky: 0xf7d9a8, fog: 0xe9cfa9,
            road: 0x6f6f6f, shortcut: 0xc49a3c, curbA: 0xd84315, curbB: 0xfff3e0
        }
    },
    {
        // マリオカートスタジアム（Mario Kart 8 / Mario Kart 8 DX の Mushroom Cup 1st course）
        // レイアウトの参照：start/finish straight -> Turn 1 -> 3-lane wide section
        //   （outer red lane has Dash Panels + coins）-> banked ridge -> left turn
        //   -> raised hairpin（up/down）-> gliding area -> final left turn -> finish straight
        // NOTE: 本 engine has no anti-gravity / glider, so those parts are approximated with
        //   banked kinks + jump ramps.
        id: 'stadium',

        name: 'マリオカートスタジアム・サーキット',
        description: '3-lane wide straights, banked kinks and a stadium grandstand course（複雑版）',
        laps: 3,
        width: 20,               // autodrome-style wide（3 lanes side by side）
        controlSamples: 200,
        radius: (t) => {
            // squircle（rounded rectangle）の polar radius：long axis on z, short on x
            const c = Math.cos(t), s = Math.sin(t);
            const ax = 820, az = 1080;                       // half width across / half length along
            const base = 1 / Math.pow(Math.pow(Math.abs(c) / ax, 4) + Math.pow(Math.abs(s) / az, 4), 0.25);
            // localized kinks（banked-ridge sections）：pinch(+depth) / outward lobe(-depth)
            return base + notch(t, 5.65, -120, 0.09)
                + notch(t, 0.63, 150, 0.13)     // Turn-1 compression（frac 0.10）
                + notch(t, 1.70, -210, 0.16)    // banked ridge outer bowl（frac 0.27）
                + notch(t, 2.83, 180, 0.12)     // infield chicane apex（frac 0.45）
                + notch(t, 3.90, -200, 0.15)    // back-straight outer bowl（frac 0.62）
                + notch(t, 4.90, 140, 0.11)     // final-corner pinch（frac 0.78）
                + notch(t, 1.10, 130, 0.10)     // extra S-curve after Turn-1
                + notch(t, 2.35, -160, 0.11)    // extra outward kink mid-section
                + notch(t, 3.40, 170, 0.10)     // extra infield pinch
                + notch(t, 4.45, -180, 0.12)    // extra outer bowl back-straight
                + notch(t, 5.95, 160, 0.10);    // extra chicane before finish
        },
        hills: [
            { frac: 0.08, half: 0.04, amp: 14 },   // banked Turn-1 compression
            { frac: 0.18, half: 0.05, amp: -16 },  // S-curve dip
            { frac: 0.27, half: 0.055, amp: 24 },  // climb over the outer ridge bowl
            { frac: 0.36, half: 0.05, amp: -22 },  // downhill into the raised hairpin
            { frac: 0.45, half: 0.05, amp: 18 },   // rise at the infield chicane apex
            { frac: 0.53, half: 0.04, amp: -14 },  // mid-section dip
            { frac: 0.62, half: 0.05, amp: -24 },  // drop into the back bowl
            { frac: 0.72, half: 0.05, amp: 20 },   // extra climb before final corner
            { frac: 0.80, half: 0.05, amp: 26 },   // banked final-corner climb
            { frac: 0.90, half: 0.04, amp: -12 }   // flatten onto the start straight
        ],
        narrow: [
            { from: 0.075, to: 0.135, width: 12 },  // Turn-1 pinch（banked）
            { from: 0.20, to: 0.24, width: 13 },    // S-curve narrow section
            { from: 0.42, to: 0.48, width: 12 },    // infield chicane section
            { from: 0.58, to: 0.62, width: 13 },    // mid-section pinch
            { from: 0.75, to: 0.81, width: 12 }     // final-corner compression
        ],
        dash: [0.94, 0.97, 0.01, 0.05, 0.13, 0.18, 0.24, 0.35, 0.50, 0.57, 0.61, 0.68, 0.83, 0.89],
        jumps: [0.16, 0.30, 0.42, 0.47, 0.55, 0.64, 0.78, 0.84, 0.96],
        lanePaint: [
            { from: 0.92, to: 0.06 },    // start/finish straight's 3 lanes
            { from: 0.15, to: 0.24 },    // wide section after Turn 1
            { from: 0.38, to: 0.48 },    // infield chicane area
            { from: 0.53, to: 0.68 },    // back straight through the outer bowl
            { from: 0.86, to: 0.91 }     // pit-lane flare
        ],
        shortcuts: [
            { entryFrac: 0.20, exitFrac: 0.36, inwardDepth: 280, width: 14, elevation: 10 },  // north-cap cut
            { entryFrac: 0.52, exitFrac: 0.66, inwardDepth: 320, width: 13, elevation: 9 },   // back-bowl cut
            { entryFrac: 0.78, exitFrac: 0.94, inwardDepth: 260, width: 13, elevation: 8 }    // final chicane cut
        ],
        theme: {
            kind: 'stadium', ground: 0x3f6b4a, sky: 0x8ecdf2, fog: 0xbcd8ea,
            road: 0x4e545c, shortcut: 0xc8a24a, curbA: 0xe53946, curbB: 0xf7f7f7
        }
    }
];


function catmullRomClosed(points, subdiv) {
    const out = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const p0 = points[(i - 1 + n) % n];
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const p3 = points[(i + 2) % n];
        for (let s = 0; s < subdiv; s++) {
            const t = s / subdiv, t2 = t * t, t3 = t2 * t;
            out.push({
                x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
            });
        }
    }
    return out;
}

/** 閉曲線を一定間隔で再サンプル */
function resampleClosed(dense, spacing) {
    const n = dense.length;
    const segLen = [];
    const cum = [0];
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const l = Math.hypot(dense[j].x - dense[i].x, dense[j].z - dense[i].z);
        segLen.push(l);
        cum.push(cum[i] + l);
    }
    const total = cum[n];
    const count = Math.max(90, Math.round(total / spacing));
    const step = total / count;
    const out = [];
    let seg = 0;
    for (let k = 0; k < count; k++) {
        const target = k * step;
        while (seg < n - 1 && cum[seg + 1] < target) seg++;
        const a = dense[seg], b = dense[(seg + 1) % n];
        const l = segLen[seg] || 1;
        const t = Math.max(0, Math.min(1, (target - cum[seg]) / l));
        out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
    return out;
}

/** 開曲線を一定間隔で再サンプル */
function resampleOpen(dense, spacing) {
    const n = dense.length;
    const cum = [0];
    for (let i = 0; i < n - 1; i++) {
        const l = Math.hypot(dense[i + 1].x - dense[i].x, dense[i + 1].z - dense[i].z);
        cum.push(cum[i] + l);
    }
    const total = cum[n - 1];
    const count = Math.max(20, Math.round(total / spacing));
    const step = total / (count - 1);
    const out = [];
    let seg = 0;
    for (let k = 0; k < count; k++) {
        const target = k * step;
        while (seg < n - 2 && cum[seg + 1] < target) seg++;
        const a = dense[seg], b = dense[seg + 1];
        const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const t = Math.max(0, Math.min(1, (target - cum[seg]) / l));
        out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
    return out;
}

function fracDist(a, b) {
    let d = a - b;
    while (d > 0.5) d -= 1;
    while (d < -0.5) d += 1;
    return d;
}

/** 滑らかな山（中心で 1、half 以上離れると 0） */
function bump(delta, half) {
    const d = Math.abs(delta);
    if (d >= half) return 0;
    return 0.5 * (1 + Math.cos((Math.PI * d) / half));
}


/** ショートカットパスを生成する */
function buildShortcutPath(mainPath, entryIdx, exitIdx, def) {
    const entry = mainPath[entryIdx];
    const exit = mainPath[exitIdx];

    // 内方向（コース中心 = (0,0) へ向かう）ベクトル
    const inEntryLen = Math.hypot(entry.x, entry.z) || 1;
    const inExitLen = Math.hypot(exit.x, exit.z) || 1;
    const inEntryX = -entry.x / inEntryLen;
    const inEntryZ = -entry.z / inEntryLen;
    const inExitX = -exit.x / inExitLen;
    const inExitZ = -exit.z / inExitLen;

    const depth = def.inwardDepth;
    const elev = def.elevation || 4;

    // 制御点：entry → 内側へ曲がって → exit（開いた Catmull-Rom）
    const ctrlPts = [
        { x: entry.x, z: entry.z },
        { x: entry.x + inEntryX * depth * 0.35, z: entry.z + inEntryZ * depth * 0.35 },
        { x: entry.x + inEntryX * depth * 0.8, z: entry.z + inEntryZ * depth * 0.8 },
        { x: (entry.x + exit.x) / 2 + inEntryX * depth, z: (entry.z + exit.z) / 2 + inEntryZ * depth },
        { x: exit.x + inExitX * depth * 0.8, z: exit.z + inExitZ * depth * 0.8 },
        { x: exit.x + inExitX * depth * 0.35, z: exit.z + inExitZ * depth * 0.35 },
        { x: exit.x, z: exit.z }
    ];

    // Catmull-Rom（開曲線版：端点は複製して境界を滑らかに）
    const extended = [ctrlPts[0], ...ctrlPts, ctrlPts[ctrlPts.length - 1]];
    const dense = [];
    for (let i = 1; i < extended.length - 2; i++) {
        const p0 = extended[i - 1];
        const p1 = extended[i];
        const p2 = extended[i + 1];
        const p3 = extended[i + 2];
        for (let s = 0; s < 8; s++) {
            const t = s / 8, t2 = t * t, t3 = t2 * t;
            dense.push({
                x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
            });
        }
    }

    const path = resampleOpen(dense, PATH_SPACING);
    const sn = path.length;

    // y 高さ：entry/exit はメイントラックの高さ、中間は elevation 高い（橋状）
    for (let i = 0; i < sn; i++) {
        const frac = i / (sn - 1);
        const bellVal = Math.sin(frac * Math.PI); // 0→1→0
        const entryY = mainPath[entryIdx].y || 2;
        const exitY = mainPath[exitIdx].y || 2;
        path[i].y = entryY + (exitY - entryY) * frac + bellVal * elev;
        path[i].halfWidth = def.width / 2;
        path[i].surface = 'shortcut';
    }

    // heading
    for (let i = 0; i < sn; i++) {
        if (i < sn - 1) {
            const nx = path[i + 1];
            path[i].heading = Math.atan2(nx.x - path[i].x, nx.z - path[i].z);
        } else {
            path[i].heading = path[i - 1].heading;
        }
    }

    return {
        path,
        entryMainIndex: entryIdx,
        exitMainIndex: exitIdx,
        width: def.width,
        elevation: elev
    };
}

/**
 * buildCourse - コース定義から全トラックデータを構築する。
 * 落とし穴・泥・ツルツル路面は生成しない（ hazard-free design ）。
 */
export function buildCourse(course) {
    const N = course.controlSamples;
    const baseWidth = course.width;

    // --- 1. 極座標から制御点群を生成 ---
    const ctrlPts = [];
    for (let i = 0; i < N; i++) {
        const theta = (i / N) * Math.PI * 2;
        const r = course.radius(theta);
        ctrlPts.push({ x: r * Math.cos(theta), z: r * Math.sin(theta) });
    }

    // --- 2. Catmull-Rom で高密度サンプリング → 等間隔リサンプル ---
    const subdiv = 6;
    const dense = catmullRomClosed(ctrlPts, subdiv);
    const path = resampleClosed(dense, PATH_SPACING);
    const n = path.length;

    // --- 3. heading（進行方向角）を計算 ---
    for (let i = 0; i < n; i++) {
        const next = path[(i + 1) % n];
        const prev = path[(i - 1 + n) % n];
        path[i].heading = Math.atan2(next.x - prev.x, next.z - prev.z);
    }

    // --- 4. halfWidth（デフォルト → narrow 区間適用） ---
    for (let i = 0; i < n; i++) {
        const frac = i / n;
        let hw = baseWidth / 2;
        if (course.narrow) {
            for (const seg of course.narrow) {
                if (frac >= seg.from && frac <= seg.to) {
                    // smooth transition at edges
                    const mid = (seg.from + seg.to) / 2;
                    const halfRange = (seg.to - seg.from) / 2;
                    const dist = Math.abs(frac - mid);
                    const t = Math.max(0, 1 - dist / halfRange);
                    const narrowW = seg.width / 2;
                    hw = baseWidth / 2 + (narrowW - baseWidth / 2) * Math.min(1, t * 2.5);
                }
            }
        }
        path[i].halfWidth = hw;
    }

    // --- 5. hills（ elevation ）適用 ---
    for (let i = 0; i < n; i++) {
        const frac = i / n;
        let y = 2; // base height above ground
        if (course.hills) {
            for (const hill of course.hills) {
                const delta = fracDist(frac, hill.frac);
                y += hill.amp * bump(delta, hill.half);
            }
        }
        path[i].y = y;
    }

    // --- 6. surface（常に 'road'、hazard なし） ---
    for (let i = 0; i < n; i++) {
        path[i].surface = 'road';
    }

    // --- 7. dash pads indices ---
    const dashPadIndices = [];
    if (course.dash) {
        for (const frac of course.dash) {
            const idx = Math.round(frac * n) % n;
            dashPadIndices.push(idx);
        }
    }

    // --- 8. jump ramps indices（通常ジャンプ台） ---
    const jumpRampIndices = [];
    if (course.jumps) {
        for (const frac of course.jumps) {
            const idx = Math.round(frac * n) % n;
            jumpRampIndices.push(idx);
        }
    }

    // --- 9. shortcuts（ショートカット + shortcut entry ramp indices） ---
    const shortcuts = [];
    const shortcutEntryIndices = []; // メイントラック上のショートカット入口ジャンプ台 index
    if (course.shortcuts) {
        for (const sc of course.shortcuts) {
            const entryIdx = Math.round(sc.entryFrac * n) % n;
            const exitIdx = Math.round(sc.exitFrac * n) % n;
            const built = buildShortcutPath(path, entryIdx, exitIdx, sc);
            shortcuts.push(built);
            shortcutEntryIndices.push(entryIdx);
            // 入口にもジャンプ台を追加（ショートカットへ飛び乗るため）
            jumpRampIndices.push(entryIdx);
        }
    }

    // --- 10. waypoints（progression チェック用：10点ごと） ---
    const waypointStep = Math.max(1, Math.floor(n / 60));
    const waypoints = [];
    for (let i = 0; i < n; i += waypointStep) {
        waypoints.push(i);
    }

    // --- 11. bounds ---
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const pt of path) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.z < minZ) minZ = pt.z;
        if (pt.z > maxZ) maxZ = pt.z;
    }
    // shortcut paths も bounds に含む
    for (const sc of shortcuts) {
        for (const pt of sc.path) {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.z < minZ) minZ = pt.z;
            if (pt.z > maxZ) maxZ = pt.z;
        }
    }
    const bounds = { minX, maxX, minZ, maxZ };

    // --- 12. length（トラック一周の距離） ---
    let length = 0;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        length += Math.hypot(path[j].x - path[i].x, path[j].z - path[i].z);
    }

    // --- 13. holes（空配列：落とし穴なし） ---
    const holes = [];

    return {
        path,
        waypoints,
        holes,
        dashPadIndices,
        jumpRampIndices,
        shortcutEntryIndices,
        shortcuts,
        width: baseWidth,
        laps: course.laps,
        bounds,
        length,
        theme: course.theme
    };
}


