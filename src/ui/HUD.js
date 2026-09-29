import { TOTAL_LAPS } from '../track/TrackData.js';

/**
 * HUD - ヘッドアップディスプレイ（速度、ラップ、順位、アイテム、メッセージ表示）
 */
export class HUD {
    constructor() {
        this.speedEl = document.getElementById('speed-display');
        this.lapEl = document.getElementById('lap-display');
        this.positionEl = document.getElementById('position-display');
        this.itemEl = document.getElementById('item-display');
        this.courseEl = document.getElementById('course-display');
        this.toastEl = document.getElementById('message-toast');
        this.startScreen = document.getElementById('start-screen');
        this.countdownScreen = document.getElementById('race-countdown');
        this.countdownText = document.getElementById('countdown-text');
        this.finishScreen = document.getElementById('finish-screen');
        this.resultText = document.getElementById('result-text');
        this._toastTimer = null;
    }

    update(kart, position, totalRacers) {
        const speedKmh = Math.round(Math.abs(kart.speed) * 120);
        if (this.speedEl) this.speedEl.textContent = `${speedKmh} km/h`;
        if (this.lapEl) this.lapEl.textContent = `LAP ${Math.min(kart.lap, TOTAL_LAPS)}/${TOTAL_LAPS}`;
        if (this.positionEl) this.positionEl.textContent = `${position}st`;

        if (this.itemEl) {
            if (kart.item) {
                const itemNames = { mushroom: '🍄', shell: '🐢', banana: '🍌' };
                this.itemEl.textContent = itemNames[kart.item] || kart.item;
            } else {
                this.itemEl.textContent = '';
            }
        }

        if (this.courseEl) {
            if (kart.falling) this.courseEl.textContent = '💀 落とし穴から復帰中…';
            else if (kart.surface === 'mud') this.courseEl.textContent = '泥路面';
            else if (kart.surface === 'slick') this.courseEl.textContent = 'ツルツル路面';
            else this.courseEl.textContent = '';
        }
    }

    /** 一時的なメッセージ（落とし穴や路面の注意表示） */
    showMessage(text) {
        if (!this.toastEl) return;
        this.toastEl.textContent = text;
        this.toastEl.classList.add('show');
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            if (this.toastEl) this.toastEl.classList.remove('show');
        }, 1800);
    }

    /** #start-screen は index.html と同じ .hidden クラスで表示/非表示を切り替える */
    showStart() { if (this.startScreen) this.startScreen.classList.remove('hidden'); }
    hideStart() { if (this.startScreen) this.startScreen.classList.add('hidden'); }

    showCountdown(text) {
        if (!this.countdownScreen) return;
        this.countdownScreen.classList.remove('hidden');
        if (this.countdownText) this.countdownText.textContent = text;
    }
    hideCountdown() {
        if (this.countdownScreen) this.countdownScreen.classList.add('hidden');
    }

    showFinish(position, time) {
        if (!this.finishScreen) return;
        this.finishScreen.classList.remove('hidden');
        const posNames = ['1st', '2nd', '3rd', '4th', '5th'];
        if (this.resultText) {
            this.resultText.textContent = `🏁 ${posNames[position - 1] || position + 'th'} Finish! ${(time / 1000).toFixed(2)}s`;
        }
    }
    hideFinish() { if (this.finishScreen) this.finishScreen.classList.add('hidden'); }
}
