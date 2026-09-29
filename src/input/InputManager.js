/**
 * InputManager - キーボード入力の管理
 */
export class InputManager {
    constructor() {
        this.keys = {};
        // keys used by the game: prevent the browser from scrolling / focusing elsewhere
        this._gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
                          'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyX'];
        this._onKeyDown = (e) => {
            this.keys[e.code] = true;
            if (this._gameKeys.includes(e.code)) e.preventDefault();
        };
        this._onKeyUp = (e) => { this.keys[e.code] = false; };
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    getInput() {
        return {
            accelerate: !!(this.keys['ArrowUp'] || this.keys['KeyW']),
            brake: !!(this.keys['ArrowDown'] || this.keys['KeyS']),
            left: !!(this.keys['ArrowLeft'] || this.keys['KeyA']),
            right: !!(this.keys['ArrowRight'] || this.keys['KeyD']),
            drift: !!(this.keys['Space'] || this.keys['ShiftLeft'] || this.keys['ShiftRight']),
            useItem: !!(this.keys['KeyE'] || this.keys['KeyX']), // HUD says "E"
        };
    }

    isPressed(code) {
        return !!this.keys[code];
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }
}
