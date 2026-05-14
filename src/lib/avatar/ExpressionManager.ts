import type { VRM } from '@pixiv/three-vrm';
import { VRMExpressionPresetName } from '@pixiv/three-vrm';

export class ExpressionManager {
	private vrm: VRM;
	private blinkTimer = 0;
	private nextBlinkTime = 2 + Math.random() * 4;
	private blinkProgress = 0;
	private isBlinking = false;
	private baseValues: Record<string, number> = {};

	constructor(vrm: VRM) {
		this.vrm = vrm;
		
		// Initialize all to zero
		const P = VRMExpressionPresetName;
		Object.values(P).forEach(p => this.baseValues[p] = 0);
	}

	setExpression(preset: string, value: number) {
		this.baseValues[preset] = value;
	}

	update(delta: number) {
		if (!this.vrm.expressionManager) return;
		const exp = this.vrm.expressionManager;
		const P = VRMExpressionPresetName;

		// Blinking logic
		this.blinkTimer += delta;
		if (!this.isBlinking && this.blinkTimer >= this.nextBlinkTime) {
			this.isBlinking = true;
			this.blinkProgress = 0;
		}

		let blinkValue = 0;
		if (this.isBlinking) {
			this.blinkProgress += delta * 8;
			if (this.blinkProgress >= 1) {
				this.isBlinking = false;
				this.blinkTimer = 0;
				this.nextBlinkTime = 2 + Math.random() * 4;
				this.blinkProgress = 0;
			}
			blinkValue = Math.sin(this.blinkProgress * Math.PI);
		}

		// Apply expressions
		// Reset all to base
		for (const preset of Object.values(P)) {
			exp.setValue(preset, this.baseValues[preset] || 0);
		}

		// Add blink on top (unless specifically closing eyes via expression)
		if (this.baseValues[P.Blink] === undefined || this.baseValues[P.Blink] < 0.5) {
			exp.setValue(P.Blink, Math.max(exp.getValue(P.Blink) || 0, blinkValue));
		}
	}
}

export class EmotionManager {
	private expressionManager: ExpressionManager;
	private currentEmotion: string = 'Neutral';

	constructor(expressionManager: ExpressionManager) {
		this.expressionManager = expressionManager;
	}

	setEmotion(emotion: string) {
		if (this.currentEmotion === emotion) return;
		this.currentEmotion = emotion;
		const P = VRMExpressionPresetName;

		// Reset non-lipsync, non-blink presets
		this.expressionManager.setExpression(P.Joy, 0);
		this.expressionManager.setExpression(P.Sorrow, 0);
		this.expressionManager.setExpression(P.Relaxed, 0);
		this.expressionManager.setExpression(P.Surprised, 0);
		this.expressionManager.setExpression(P.BlinkLeft, 0);
		this.expressionManager.setExpression(P.BlinkRight, 0);

		switch (emotion) {
			case 'Happy':
			case 'Enthusiastic':
			case 'Blessed':
				this.expressionManager.setExpression(P.Joy, 0.7);
				break;
			case 'Sad':
				this.expressionManager.setExpression(P.Sorrow, 0.7);
				break;
			case 'Romantic':
			case 'Whisper':
				this.expressionManager.setExpression(P.Relaxed, 0.5);
				this.expressionManager.setExpression(P.Joy, 0.2);
				break;
			case 'Flirty':
				// A softer relaxed look instead of a permanent wink
				this.expressionManager.setExpression(P.Relaxed, 0.6);
				this.expressionManager.setExpression(P.Joy, 0.5);
				break;
			case 'Sarcastic':
				this.expressionManager.setExpression(P.Relaxed, 0.4);
				this.expressionManager.setExpression(P.Joy, 0.2);
				break;
		}
	}
}

export class LipSyncManager {
	private expressionManager: ExpressionManager;
	private smoothMouth = 0;

	constructor(expressionManager: ExpressionManager) {
		this.expressionManager = expressionManager;
	}

	update(mouthVolume: number, delta: number, isSpeaking: boolean) {
		const P = VRMExpressionPresetName;
		
		this.smoothMouth += (mouthVolume - this.smoothMouth) * Math.min(1, delta * 15);
		
		if (isSpeaking) {
			this.expressionManager.setExpression(P.Aa, this.smoothMouth * 0.9);
			this.expressionManager.setExpression(P.Oh, this.smoothMouth * 0.3);
		} else {
			this.expressionManager.setExpression(P.Aa, 0);
			this.expressionManager.setExpression(P.Oh, 0);
		}
	}
}
