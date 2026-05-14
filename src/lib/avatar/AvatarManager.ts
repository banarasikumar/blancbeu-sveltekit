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
	
	// Mouse tracking
	private mouseTarget = new THREE.Vector3(0, 1.4, 2);

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.clock = new THREE.Clock();

		// Renderer
		this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;

		// Scene
		this.scene = new THREE.Scene();

		// Camera
		this.camera = new THREE.PerspectiveCamera(30, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
		this.camera.position.set(0, 1.35, 2.2);
		this.camera.lookAt(0, 1.3, 0);

		// LookAt Target
		this.lookAtTarget = new THREE.Object3D();
		this.lookAtTarget.position.set(0, 1.4, 2);
		this.scene.add(this.lookAtTarget);

		this.setupLighting();
		this.updateSize();

		window.addEventListener('resize', this.updateSize.bind(this));
		window.addEventListener('mousemove', this.onMouseMove.bind(this));
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

	private onMouseMove(e: MouseEvent) {
		const x = (e.clientX / window.innerWidth) * 2 - 1;
		const y = -(e.clientY / window.innerHeight) * 2 + 1;
		// Map mouse to a reasonable look area
		this.mouseTarget.set(x * 1.5, 1.4 + y * 0.5, 2);
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

	public updateState(mouthVolume: number, isSpeaking: boolean, emotion: string, action: string) {
		this.isSpeaking = isSpeaking;

		if (this.emotionManager) this.emotionManager.setEmotion(emotion);
		if (this.lipSyncManager) this.lipSyncManager.update(mouthVolume, this.clock.getDelta(), isSpeaking);

		if (this.animationManager) {
			if (action !== 'None') {
				this.animationManager.playState(action);
			} else if (isSpeaking) {
				// Only play a specific talking state if we are speaking and no specific action is requested
				// Otherwise let the gesture cooldown trigger random talking animations
				if (this.animationManager.getCurrentState() === 'Idle' || 
					this.animationManager.getCurrentState() === 'BreathingIdle') {
					this.animationManager.playState('Talking');
				}
			} else {
				// Return to idle
				if (!['Idle', 'BreathingIdle'].includes(this.animationManager.getCurrentState())) {
					this.animationManager.playState('Idle');
				}
			}
		}
	}

	private animate() {
		this.animFrameId = requestAnimationFrame(this.animate.bind(this));
		const delta = this.clock.getDelta();
		const t = this.clock.getElapsedTime();

		if (!this.vrm) return;

		// --- Gestures & Conversational Movement ---
		if (this.isSpeaking && this.animationManager) {
			this.gestureCooldown -= delta;
			if (this.gestureCooldown <= 0) {
				// Random talking gesture
				const talkAnims = ['Talking', 'Talking1', 'Talking2'];
				const anim = talkAnims[Math.floor(Math.random() * talkAnims.length)];
				this.animationManager.playState(anim, 0.4);
				this.gestureCooldown = 3 + Math.random() * 4;
			}
		} else {
			this.gestureCooldown = 0;
			// Idle state variations
			if (this.animationManager && ['Idle', 'BreathingIdle'].includes(this.animationManager.getCurrentState())) {
				if (Math.random() < 0.005) { // Occasional shift
					const nextIdle = this.animationManager.getCurrentState() === 'Idle' ? 'BreathingIdle' : 'Idle';
					this.animationManager.playState(nextIdle, 1.0);
				}
			}
		}

		// --- LookAt Update ---
		if (this.isSpeaking) {
			// Look near camera when speaking
			this.lookAtTarget.position.lerp(new THREE.Vector3(0, 1.4, 2), delta * 5);
		} else {
			// Follow mouse or wander
			const wanderX = Math.sin(t * 0.5) * 0.2;
			const wanderY = Math.cos(t * 0.3) * 0.1;
			this.mouseTarget.x += wanderX;
			this.mouseTarget.y += wanderY;
			this.lookAtTarget.position.lerp(this.mouseTarget, delta * 3);
			this.mouseTarget.x -= wanderX;
			this.mouseTarget.y -= wanderY;
		}

		// Update sub-managers
		if (this.animationManager) this.animationManager.update(delta);
		if (this.expressionManager) this.expressionManager.update(delta);

		// VRM & Render
		this.vrm.update(delta);
		this.renderer.render(this.scene, this.camera);
	}

	public dispose() {
		if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
		window.removeEventListener('resize', this.updateSize.bind(this));
		window.removeEventListener('mousemove', this.onMouseMove.bind(this));
		if (this.animationManager) this.animationManager.dispose();
		if (this.renderer) {
			this.renderer.dispose();
			this.renderer.forceContextLoss();
		}
		if (this.vrm) this.scene.remove(this.vrm.scene);
	}
}
