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
	private resizeObserver: ResizeObserver;
	
	// Gesture state
	private isSpeaking: boolean = false;
	private gestureCooldown: number = 0;
	private lastAction: string = 'None';
	private actionStartTime: number = 0;
	private isOneShotPlaying: boolean = false; // true when a one-shot action (Wave, Kiss, etc.) is active
	
	// Procedural posture
	private proceduralLeanWeight: number = 0;
	private lastAppliedSpine: number = 0;
	private lastAppliedChest: number = 0;
	private lastAppliedUpperChest: number = 0;
	private lastAppliedNeck: number = 0;

	// Procedural head tracking — keeps Ani looking directly into the camera
	private headTrackYaw: number = 0;
	private headTrackPitch: number = 0;
	// Reusable THREE objects to avoid GC pressure in the render loop
	private _htHeadWorldPos = new THREE.Vector3();
	private _htDirToCamera = new THREE.Vector3();
	private _htParentWorldQuat = new THREE.Quaternion();
	private _htLocalDir = new THREE.Vector3();

	// Dynamic Camera — tighter portrait framing like Grok Ani
	private targetCameraPos = new THREE.Vector3(0, 0.8, 2.1);
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

		this.resizeObserver = new ResizeObserver(() => this.updateSize());
		if (canvas.parentElement) {
			this.resizeObserver.observe(canvas.parentElement);
		}
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

		// Ensure layout is perfectly settled for initial framing
		this.updateSize();
		this.animate();
	}

	// Cached state values updated by the Svelte component
	private pendingMouthVolume: number = 0;
	private pendingEmotion: string = 'Neutral';
	private pendingAction: string = 'None';
	private hasLoggedDance: boolean = false;

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

		// Continuously poll one-shot animations to see if they've finished
		if (this.isOneShotPlaying && this.animationManager) {
			if (this.animationManager.getCurrentState() === this.lastAction) {
				const clip = this.animationManager.clips.get(this.animationManager.currentPath);
				if (clip) {
					const currentActionObj = this.animationManager.getMixer().existingAction(clip);
					
					// Bulletproof completion check: it must not be running, AND it must have actually started (time > 0)
					// or its time must be exactly at the end of the clip (clamped).
					if (currentActionObj) {
						const isAtEnd = currentActionObj.time >= clip.duration - 0.01;
						const isFinished = !currentActionObj.isRunning() || isAtEnd;
						
						if (isFinished && currentActionObj.time > 0) {
							this.isOneShotPlaying = false;
							this.lastAction = 'None';
							this.pendingAction = 'None'; // clear the pending action too!
							
							// Immediately transition back to appropriate state
							if (this.isSpeaking) {
								this.animationManager.playState('Talking', 0.4);
							} else {
								const randomIdle = Math.random() > 0.8 ? 'BreathingIdle' : 'Idle';
								this.animationManager.playState(randomIdle, 0.5);
							}
						}
					}
				}
			}
		}

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
			this.targetCameraPos.set(0, 0.8, 2.1);
			this.targetCameraLookAt.set(0, 0.9, 0);
		}

		// --- Animation state machine ---
		const IDLE_STATES = ['Idle', 'BreathingIdle', 'Idle1', 'StandingIdle', 'SittingIdle'];
		const ONE_SHOT_ACTIONS = ['Wave', 'Greeting', 'TurnAround', 'Bow', 'FlyingKiss', 'Laugh', 'Shrug', 'Happy', 'LeanForward', 'RomanticPose'];
		const SUSTAINED_ACTIONS = ['Dance']; // These loop until the UI resets activeAction to 'None'
		const TALKING_STATE = 'Talking';

		if (this.animationManager) {
			const curState = this.animationManager.getCurrentState();

			// DEBUG LOG TO SERVER
			if (action === 'Dance' && !this.hasLoggedDance) {
				this.hasLoggedDance = true;
				fetch('/api/debug', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ 
						event: 'AVATAR_ANIMATE_STATE',
						pendingAction: this.pendingAction,
						lastAction: this.lastAction,
						isOneShotPlaying: this.isOneShotPlaying,
						isSpeaking: this.isSpeaking,
						curState: curState
					})
				}).catch(() => {});
			} else if (action !== 'Dance') {
				this.hasLoggedDance = false;
			}

			if (SUSTAINED_ACTIONS.includes(action)) {
				// Sustained action (e.g. Dance) — play it and keep looping until the UI resets action to 'None'
				if (this.lastAction !== action) {
					this.lastAction = action;
					this.isOneShotPlaying = false;
					this.animationManager.playState(action);
				}
				// While sustained action is active, do NOT let isSpeaking or idle override it
			} else if (ONE_SHOT_ACTIONS.includes(action)) {
				// One-shot action — play once
				if (this.lastAction !== action) {
					this.lastAction = action;
					this.isOneShotPlaying = true;
					this.animationManager.playState(action);
				}
			} else if (this.isOneShotPlaying) {
				// Let the one-shot animation finish. The animate() loop will detect when it ends
				// and automatically transition back to Talking or Idle.
			} else if (this.isSpeaking) {
				// Talking takes priority only when no sustained/one-shot action is active
				if (SUSTAINED_ACTIONS.includes(this.lastAction)) {
					// Sustained action just ended (action went from 'Dance' -> 'None' while speaking)
					// Transition to talking
				}
				this.lastAction = 'None';
				this.isOneShotPlaying = false;
				// Speaking — play talking animation with body gestures
				if (curState !== TALKING_STATE) {
					// Transition to talking from ANY state (idle, finished one-shot, etc.)
					this.animationManager.playState(TALKING_STATE, 0.4);
					this.gestureCooldown = 2.5 + Math.random() * 2;
				} else {
					// Already talking — cycle to a different talking variant periodically
					this.gestureCooldown -= delta;
					if (this.gestureCooldown <= 0) {
						this.animationManager.playState(TALKING_STATE, 0.5, true);
						this.gestureCooldown = 2.5 + Math.random() * 2;
					}
				}
			} else {
				this.lastAction = 'None';
				this.isOneShotPlaying = false;
				// Not speaking, no action — idle
				if (!IDLE_STATES.includes(curState) && !ONE_SHOT_ACTIONS.includes(curState)) {
					this.animationManager.playState('Idle', 0.6);
				} else if (Math.random() < 0.003 && IDLE_STATES.includes(curState)) {
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

		// Clean slate for the mixer: remove our procedural offsets from the previous frame
		this.removeProceduralPosture();

		// Update sub-managers
		if (this.animationManager) this.animationManager.update(delta);
		if (this.expressionManager) this.expressionManager.update(delta);

		// Re-apply relaxed hand pose AFTER mixer update, but ONLY during idle states.
		// During Talking or one-shot actions, the animation's own hand/finger keyframes should play unmodified for natural gesturing.
		if (this.animationManager && IDLE_STATES.includes(this.animationManager.getCurrentState())) {
			this.applyRelaxedHandPose();
		}

		// Procedural head tracking — gently blends the animation's head rotation with a camera lookAt
		this.applyHeadTracking(delta);

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

	/**
	 * Remove the procedural offsets from the previous frame so the AnimationMixer 
	 * doesn't infinitely stack rotations on non-keyframed bones.
	 */
	private removeProceduralPosture() {
		if (!this.vrm?.humanoid) return;
		
		const spineNode = this.vrm.humanoid.getNormalizedBoneNode('spine' as any);
		const chestNode = this.vrm.humanoid.getNormalizedBoneNode('chest' as any);
		const upperChestNode = this.vrm.humanoid.getNormalizedBoneNode('upperChest' as any);
		const neckNode = this.vrm.humanoid.getNormalizedBoneNode('neck' as any);

		// Temporary override: disabled procedural leaning due to non-standard bone axes causing sideways rolling
		// if (spineNode) spineNode.rotation.x -= this.lastAppliedSpine;
		// if (chestNode) chestNode.rotation.x -= this.lastAppliedChest;
		// if (upperChestNode) upperChestNode.rotation.x -= this.lastAppliedUpperChest;
		// if (neckNode) neckNode.rotation.x -= this.lastAppliedNeck;
	}

	/**
	 * Procedural head tracking: rotates neck and head bones so Ani always
	 * looks directly into the camera, regardless of body animation sway.
	 *
	 * Since neck/head are excluded from the animation retargeter, these bones
	 * have no keyframe data and sit at rest pose. During body animations the
	 * torso rotates, dragging the head along and making Ani look away.
	 * This method counter-rotates neck/head to compensate.
	 */
	private applyHeadTracking(delta: number) {
		if (!this.vrm?.humanoid) return;

		const headNode = this.vrm.humanoid.getNormalizedBoneNode('head' as any);
		const neckNode = this.vrm.humanoid.getNormalizedBoneNode('neck' as any);
		if (!headNode) return;

		// 1. Get head's current world position (influenced by all parent bone animations)
		headNode.getWorldPosition(this._htHeadWorldPos);

		// 2. Direction from head to camera in world space
		this._htDirToCamera.subVectors(this.camera.position, this._htHeadWorldPos);
		const dist = this._htDirToCamera.length();
		if (dist < 0.01) return;
		this._htDirToCamera.divideScalar(dist); // normalize

		// 3. Get the neck's parent (upperChest) world quaternion.
		//    This tells us what "forward" means in the neck/head's local space
		//    after body animations have rotated the torso.
		const parentNode = neckNode ? neckNode.parent : headNode.parent;
		if (!parentNode) return;
		parentNode.getWorldQuaternion(this._htParentWorldQuat);

		// 4. Transform camera direction into the parent's local space
		this._htLocalDir.copy(this._htDirToCamera)
			.applyQuaternion(this._htParentWorldQuat.invert());

		// 5. Calculate yaw & pitch from local direction
		//    VRM normalized bones: +Z = forward, +Y = up, +X = right
		const lx = this._htLocalDir.x;
		const ly = this._htLocalDir.y;
		const lz = this._htLocalDir.z;
		const targetYaw = Math.atan2(lx, lz);
		const targetPitch = Math.atan2(-ly, Math.sqrt(lx * lx + lz * lz));

		// 6. Clamp to prevent unnatural head turns (~±30° yaw, ~±20° pitch)
		const clampedYaw = THREE.MathUtils.clamp(targetYaw, -0.6, 0.6);
		const clampedPitch = THREE.MathUtils.clamp(targetPitch, -0.4, 0.4);

		// 7. Smooth interpolation for natural head movement
		const lerpSpeed = Math.min(delta * 4, 1);
		this.headTrackYaw += (clampedYaw - this.headTrackYaw) * lerpSpeed;
		this.headTrackPitch += (clampedPitch - this.headTrackPitch) * lerpSpeed;

		// 8. Blend the procedural tracking WITH the underlying animation
		// 50% tracking (bias towards camera), 50% animation (natural sway)
		const blendWeight = 0.5;

		if (neckNode) {
			neckNode.rotation.y = THREE.MathUtils.lerp(neckNode.rotation.y, this.headTrackYaw * 0.4, blendWeight);
			neckNode.rotation.x = THREE.MathUtils.lerp(neckNode.rotation.x, this.headTrackPitch * 0.4, blendWeight);
		}
		
		headNode.rotation.y = THREE.MathUtils.lerp(headNode.rotation.y, this.headTrackYaw * 0.6, blendWeight);
		headNode.rotation.x = THREE.MathUtils.lerp(headNode.rotation.x, this.headTrackPitch * 0.6, blendWeight);
	}

	/**
	 * Procedurally pitch the upper body forward to create an intimate, 
	 * focused gaze into the low-placed camera.
	 */
	private applyProceduralPosture(delta: number, action: string, emotion: string) {
		if (!this.vrm?.humanoid) return;

		// We don't want to break full-body actions
		const NO_LEAN_ACTIONS = ['Dance', 'TurnAround', 'Bow', 'Sit'];
		let targetLean = 0;

		if (!NO_LEAN_ACTIONS.includes(action)) {
			// Normal lean vs intimate deep lean
			targetLean = emotion === 'Whisper' ? 0.15 : 0.08;
		}

		// Smoothly interpolate to target lean to avoid snapping
		this.proceduralLeanWeight += (targetLean - this.proceduralLeanWeight) * delta * 3.0;

		const spineLean = this.proceduralLeanWeight * 1.5;
		const chestLean = -this.proceduralLeanWeight * 0.8;
		const upperChestLean = -this.proceduralLeanWeight * 0.5;
		const neckLean = this.proceduralLeanWeight * 0.8;

		// Apply the S-Curve posture (Grok Ani style)
		// Spine bends forward, chest/upperChest arch back, neck tilts forward to lock eyes
		const spineNode = this.vrm.humanoid.getNormalizedBoneNode('spine' as any);
		const chestNode = this.vrm.humanoid.getNormalizedBoneNode('chest' as any);
		const upperChestNode = this.vrm.humanoid.getNormalizedBoneNode('upperChest' as any);
		const neckNode = this.vrm.humanoid.getNormalizedBoneNode('neck' as any);

		// Apply the S-Curve posture (Grok Ani style)
		// Disabled temporarily as local X axis is roll on this model, not pitch.
		// if (spineNode) spineNode.rotation.x += spineLean;
		// if (chestNode) chestNode.rotation.x += chestLean;
		// if (upperChestNode) upperChestNode.rotation.x += upperChestLean;
		// if (neckNode) neckNode.rotation.x += neckLean;

		// Save the offsets we just applied so we can remove them next frame
		this.lastAppliedSpine = spineLean;
		this.lastAppliedChest = chestLean;
		this.lastAppliedUpperChest = upperChestLean;
		this.lastAppliedNeck = neckLean;
	}

	public dispose() {
		if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
		this.resizeObserver.disconnect();
		if (this.animationManager) this.animationManager.dispose();
		if (this.renderer) {
			this.renderer.dispose();
			this.renderer.forceContextLoss();
		}
		if (this.vrm) this.scene.remove(this.vrm.scene);
	}
}
