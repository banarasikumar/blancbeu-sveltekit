import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm';
import { AnimationManager } from './AnimationManager';
import { ExpressionManager, EmotionManager, LipSyncManager } from './ExpressionManager';

export class AvatarManager {
	public canvas: HTMLCanvasElement;
	public scene: THREE.Scene;
	public camera: THREE.PerspectiveCamera;
	public renderer: THREE.WebGLRenderer;
	public vrm: VRM | null = null;

	public animationManager: AnimationManager | null = null;
	public expressionManager: ExpressionManager | null = null;
	public emotionManager: EmotionManager | null = null;
	public lipSyncManager: LipSyncManager | null = null;

	private clock: THREE.Clock;
	private animFrameId: number = 0;
	private lookAtTarget: THREE.Object3D;
	
	// Gesture state
	private isSpeaking: boolean = false;
	private gestureCooldown: number = 0;
	

	// Dynamic Camera — positioned low, looking at the chest to keep head near top of screen
	private targetCameraPos = new THREE.Vector3(0, 0.75, 1.9);
	private targetCameraLookAt = new THREE.Vector3(0, 0.9, 0);
	private currentCameraLookAt = new THREE.Vector3(0, 0.9, 0);

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.clock = new THREE.Clock();

		// Renderer
		this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;

		// Scene
		this.scene = new THREE.Scene();

		// Camera - low angle looking up, like Grok companion
		this.camera = new THREE.PerspectiveCamera(32, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
		this.camera.position.copy(this.targetCameraPos);
		this.camera.lookAt(this.currentCameraLookAt);

		// LookAt Target - Position it exactly where the camera is
		this.lookAtTarget = new THREE.Object3D();
		this.lookAtTarget.position.copy(this.camera.position);
		this.scene.add(this.lookAtTarget);

		this.setupLighting();
		this.updateSize();

		window.addEventListener('resize', this.updateSize.bind(this));
	}

	private setupLighting() {
		this.scene.add(new THREE.AmbientLight(0xffffff, 2.2));
		const dir = new THREE.DirectionalLight(0xffeedd, 1.5);
		dir.position.set(1, 2, 3);
		this.scene.add(dir);
		const rim = new THREE.DirectionalLight(0xff88aa, 1.0);
		rim.position.set(-2, 1, -1);
		this.scene.add(rim);
		const fill = new THREE.DirectionalLight(0x88bbff, 0.5);
		fill.position.set(0, 0, -2);
		this.scene.add(fill);
	}

	public updateSize() {
		const p = this.canvas.parentElement;
		if (!p) return;
		this.renderer.setSize(p.clientWidth, p.clientHeight);
		this.camera.aspect = p.clientWidth / p.clientHeight;
		this.camera.updateProjectionMatrix();
	}


	public async loadModel(url: string = '/Ani.vrm') {
		const loader = new GLTFLoader();
		loader.register((parser) => new VRMLoaderPlugin(parser));
		
		const gltf = await loader.loadAsync(url);
		this.vrm = gltf.userData.vrm as VRM;
		this.scene.add(this.vrm.scene);

		// Disable frustum culling to prevent blinking issues
		this.vrm.scene.traverse((obj) => {
			obj.frustumCulled = false;
		});

		// Spring bones setup
		if (this.vrm.springBoneManager) {
			// They update automatically in vrm.update
		}

		// LookAt setup
		if (this.vrm.lookAt) {
			this.vrm.lookAt.target = this.lookAtTarget;
		}

		// Set relaxed hand pose so fingers are visible (natural curl instead of flat/extended)
		this.applyRelaxedHandPose();

		// Initialize Managers
		this.animationManager = new AnimationManager(this.vrm);
		await this.animationManager.preload();
		
		this.expressionManager = new ExpressionManager(this.vrm);
		this.emotionManager = new EmotionManager(this.expressionManager);
		this.lipSyncManager = new LipSyncManager(this.expressionManager);

		// Start idle
		this.animationManager.playState('Idle');

		this.animate();
	}

	// Cached state values updated by the Svelte component
	private pendingMouthVolume: number = 0;
	private pendingEmotion: string = 'Neutral';
	private pendingAction: string = 'None';

	public updateState(mouthVolume: number, isSpeaking: boolean, emotion: string, action: string) {
		// Store values — actual processing happens in animate() with a single clock.getDelta()
		this.isSpeaking = isSpeaking;
		this.pendingMouthVolume = mouthVolume;
		this.pendingEmotion = emotion;
		this.pendingAction = action;
	}

	private animate() {
		this.animFrameId = requestAnimationFrame(this.animate.bind(this));
		const delta = this.clock.getDelta();

		if (!this.vrm) return;

		// --- Process pending state (emotion, lip sync, camera, animation transitions) ---
		const action = this.pendingAction;
		const emotion = this.pendingEmotion;

		if (this.emotionManager) this.emotionManager.setEmotion(emotion);
		if (this.lipSyncManager) this.lipSyncManager.update(this.pendingMouthVolume, delta, this.isSpeaking);

		// Adjust camera dynamically
		if (emotion === 'Whisper') {
			this.targetCameraPos.set(0, 0.9, 1.2);
			this.targetCameraLookAt.set(0, 1.1, 0);
		} else if (['Dance', 'TurnAround', 'Bow', 'Sit'].includes(action)) {
			this.targetCameraPos.set(0, 0.5, 3.0);
			this.targetCameraLookAt.set(0, 0.8, 0);
		} else {
			this.targetCameraPos.set(0, 0.75, 1.9);
			this.targetCameraLookAt.set(0, 0.9, 0);
		}

		// --- Animation state machine ---
		const IDLE_STATES = ['Idle', 'BreathingIdle', 'Idle1', 'StandingIdle', 'SittingIdle'];
		const ONE_SHOT_ACTIONS = ['Wave', 'Greeting', 'TurnAround', 'Bow', 'FlyingKiss', 'Laugh', 'Shrug', 'Happy', 'LeanForward', 'RomanticPose'];
		const TALKING_STATE = 'Talking';

		if (this.animationManager) {
			const curState = this.animationManager.getCurrentState();

			if (action !== 'None') {
				// Explicit action requested by AI
				this.animationManager.playState(action);
			} else if (this.isSpeaking) {
				// Speaking — play talking animation with body gestures
				if (curState !== TALKING_STATE) {
					// Transition to talking from ANY state (idle, finished one-shot, etc.)
					this.animationManager.playState(TALKING_STATE, 0.4);
					this.gestureCooldown = 4 + Math.random() * 3;
				} else {
					// Already talking — cycle to a different talking variant periodically
					this.gestureCooldown -= delta;
					if (this.gestureCooldown <= 0) {
						this.animationManager.playState(TALKING_STATE, 0.5, true);
						this.gestureCooldown = 4 + Math.random() * 3;
					}
				}
			} else {
				// Not speaking, no action — idle
				if (!IDLE_STATES.includes(curState)) {
					this.animationManager.playState('Idle', 0.6);
				} else if (Math.random() < 0.003) {
					// Occasional organic idle shift
					this.animationManager.playState('Idle', 1.0, true);
				}
				this.gestureCooldown = 0;
			}
		}

		// Dynamic camera movement
		this.camera.position.lerp(this.targetCameraPos, delta * 1.5);
		this.currentCameraLookAt.lerp(this.targetCameraLookAt, delta * 1.5);
		this.camera.lookAt(this.currentCameraLookAt);

		// --- LookAt: ALWAYS gaze directly into camera (direct eye contact) ---
		this.lookAtTarget.position.copy(this.camera.position);

		// Update sub-managers
		if (this.animationManager) this.animationManager.update(delta);
		if (this.expressionManager) this.expressionManager.update(delta);

		// Re-apply relaxed hand pose AFTER mixer update so animations can't flatten fingers
		this.applyRelaxedHandPose();

		// VRM & Render
		this.vrm.update(delta);
		this.renderer.render(this.scene, this.camera);
	}

	/**
	 * Apply a natural relaxed hand pose so fingers curl slightly.
	 * This prevents the "empty sleeves" look where flat/extended fingers
	 * clip inside the sleeve mesh and become invisible.
	 */
	private applyRelaxedHandPose() {
		if (!this.vrm?.humanoid) return;

		// Finger bones to curl with a gentle ~15-25° bend per joint
		const fingerCurl: Array<{ bone: string; angle: number }> = [
			// Left hand fingers
			{ bone: 'leftIndexProximal', angle: 0.25 },
			{ bone: 'leftIndexIntermediate', angle: 0.35 },
			{ bone: 'leftIndexDistal', angle: 0.20 },
			{ bone: 'leftMiddleProximal', angle: 0.30 },
			{ bone: 'leftMiddleIntermediate', angle: 0.40 },
			{ bone: 'leftMiddleDistal', angle: 0.25 },
			{ bone: 'leftRingProximal', angle: 0.30 },
			{ bone: 'leftRingIntermediate', angle: 0.40 },
			{ bone: 'leftRingDistal', angle: 0.25 },
			{ bone: 'leftLittleProximal', angle: 0.35 },
			{ bone: 'leftLittleIntermediate', angle: 0.45 },
			{ bone: 'leftLittleDistal', angle: 0.30 },
			{ bone: 'leftThumbProximal', angle: 0.15 },
			{ bone: 'leftThumbDistal', angle: 0.20 },
			// Right hand fingers
			{ bone: 'rightIndexProximal', angle: 0.25 },
			{ bone: 'rightIndexIntermediate', angle: 0.35 },
			{ bone: 'rightIndexDistal', angle: 0.20 },
			{ bone: 'rightMiddleProximal', angle: 0.30 },
			{ bone: 'rightMiddleIntermediate', angle: 0.40 },
			{ bone: 'rightMiddleDistal', angle: 0.25 },
			{ bone: 'rightRingProximal', angle: 0.30 },
			{ bone: 'rightRingIntermediate', angle: 0.40 },
			{ bone: 'rightRingDistal', angle: 0.25 },
			{ bone: 'rightLittleProximal', angle: 0.35 },
			{ bone: 'rightLittleIntermediate', angle: 0.45 },
			{ bone: 'rightLittleDistal', angle: 0.30 },
			{ bone: 'rightThumbProximal', angle: 0.15 },
			{ bone: 'rightThumbDistal', angle: 0.20 },
		];

		for (const { bone, angle } of fingerCurl) {
			const node = this.vrm.humanoid.getNormalizedBoneNode(bone as any);
			if (node) {
				// Curl around the local X axis (flex the finger joint)
				node.rotation.x = angle;
			}
		}
	}

	public dispose() {
		if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
		window.removeEventListener('resize', this.updateSize.bind(this));
		if (this.animationManager) this.animationManager.dispose();
		if (this.renderer) {
			this.renderer.dispose();
			this.renderer.forceContextLoss();
		}
		if (this.vrm) this.scene.remove(this.vrm.scene);
	}
}
