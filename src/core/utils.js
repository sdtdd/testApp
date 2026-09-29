/** 共用ユーティリティ */

/** THREE オブジェクト配下の geometry / material を破棄する */
export function disposeObject(obj) {
    if (!obj) return;
    obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const m of mats) m.dispose();
        }
    });
}
