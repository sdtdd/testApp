/**
 * specs - 車体と外壁の寸法（単一ソース）
 * Kart の衝突判定と Walls の形状生成が同じ値を共有することで、
 * 「見えている壁」と「カートが止まる位置」のズレを防ぐ。
 * （依存を持たないleafモジュール → Kart ⇄ Walls の循環 import を回避できる）
 */

// --- カート ---
export const KART_HEIGHT = 1.5;   // 地面から帽子のてっぺんまで
export const KART_RADIUS = 0.9;   // 衝突半径（車幅 + ホイール）

// --- 外壁 ---
export const WALL_HEIGHT_RATIO = 0.7;                        // 車体高さの70%
export const WALL_HEIGHT = KART_HEIGHT * WALL_HEIGHT_RATIO;  // ≈ 1.05m
export const WALL_THICKNESS = 0.9;    // 壁の厚さ
export const WALL_INNER_OFFSET = 0.15; // 路面端から壁の内面までの隙間
export const WALL_BASE_DEPTH = 0.3;   // 壁を路面下に沈める深さ

/**
 * センターラインからの距離として、車体外側が壁の内面にちょうど接する位置。
 * Kart の衝突限界と AI の「壁に寄りすぎた」判定で共有する。
 * @param {number} halfWidth 当該地点の路面半幅
 */
export function wallContactLimit(halfWidth) {
    return halfWidth + WALL_INNER_OFFSET - KART_RADIUS;
}
