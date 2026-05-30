import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import type { VRM } from '@pixiv/three-vrm';
import { AnimationRetargeter } from './AnimationRetargeter';
const ANIMATION_MAP: Record<string, string[]> = {
	'Idle': [
		'/animations/Standing Idle.fbx',
		'/animations/Idle (1).fbx',
		'/animations/Idle.fbx'
	],
	'BreathingIdle': ['/animations/Breathing Idle.fbx'],
	'Idle1': ['/animations/Idle (1).fbx'],
	'SittingIdle': ['/animations/Sitting Idle.fbx'],
	'StandingIdle': [
		'/animations/Standing Idle.fbx',
		'/animations/Female Standing Pose.fbx',
		'/animations/Female Standing Pose (1).fbx',
		'/animations/Female Standing Pose (2).fbx',
		'/animations/Female Standing Pose (3).fbx',
		'/animations/Female Standing Pose (4).fbx',
		'/animations/Female Standing Pose (5).fbx',
		'/animations/Female Standing Pose (6).fbx',
		'/animations/Female Standing Pose (7).fbx',
		'/animations/Female Standing Pose (8).fbx'
	],
	'Talking': [
		'/animations/Talking.fbx',
		'/animations/Talking (1).fbx',
		'/animations/Talking (2).fbx'
	],
	'Talking1': ['/animations/Talking (1).fbx'],
	'Talking2': ['/animations/Talking (2).fbx'],
	'Wave': ['/animations/Waving.fbx'],
	'Greeting': ['/animations/Standing Greeting.fbx'],
	'Happy': ['/animations/Happy.fbx', '/animations/Happy (1).fbx'],
	'Thinking': ['/animations/Thinking.fbx', '/animations/Thinking (1).fbx'],
	'Dance': [
		'/animations/Dancing.fbx',
		'/animations/Dancing (1).fbx',
		'/animations/Belly Dance.fbx',
		'/animations/Hip Hop Dancing.fbx',
		'/animations/Hip Hop Dancing (1).fbx',
		'/animations/Hip Hop Dancing (2).fbx',
		'/animations/Jazz Dancing.fbx',
		'/animations/Jazz Dancing (1).fbx',
		'/animations/Rumba Dancing.fbx',
		'/animations/Salsa Dancing.fbx',
		'/animations/Samba Dancing.fbx'
	],
	'TurnAround': ['/animations/180 Turn W_ Briefcase.fbx', '/animations/Left Turn.fbx', '/animations/Left Turn (1).fbx', '/animations/Right Turn.fbx', '/animations/Right Turn (1).fbx'],
	'Bow': ['/animations/Female Dance Pose.fbx', '/animations/Female Dance Pose (1).fbx', '/animations/Female Dance Pose (2).fbx'],
	'Sit': ['/animations/Female Sitting Pose.fbx'],
	'Laugh': ['/animations/Happy (1).fbx'],
	'Cry': ['/animations/Crying.fbx'],
	'StandCasual': ['/animations/Female Standing Pose.fbx'],
	'Shrug': ['/animations/No.fbx'],
	'RomanticPose': ['/animations/Female Dynamic Pose.fbx', '/animations/Female Dynamic Pose (1).fbx'],
	'LeanForward': ['/animations/Female Dynamic Pose.fbx'],
	'FlyingKiss': ['/animations/Kiss.fbx']
};

export class AnimationManager {
	private mixer: THREE.AnimationMixer;
	private vrm: VRM;
	private loader: FBXLoader;
	private clips: Map<string, THREE.AnimationClip> = new Map();
	private actions: Map<string, THREE.AnimationAction> = new Map();
	private currentAction: THREE.AnimationAction | null = null;
	private currentState: string = '';
	private currentPath: string = '';

	constructor(vrm: VRM) {
		this.vrm = vrm;
		
		// The mixer MUST target the normalizedHumanBonesRoot so it can find the 'Normalized_*' bone proxies.
		// These proxy bones are not necessarily direct descendants of vrm.scene in three-vrm 3.x.
		const mixerRoot = vrm.humanoid?.normalizedHumanBonesRoot || vrm.scene;
		this.mixer = new THREE.AnimationMixer(mixerRoot);
		
		this.loader = new FBXLoader();

		// Automatically return to Idle when a one-shot animation finishes
		this.mixer.addEventListener('finished', (e) => {
			// Don't auto-idle for Dance — it's handled by the AvatarManager state machine
			if (this.currentAction === e.action && this.currentState !== 'Dance') {
				this.playState('Idle', 0.5);
			}
		});
	}

	async preload() {
		// Preload essentials AND action animations for instant responsiveness
		const essentials = ['Idle', 'Talking', 'Wave'];
		// Preload all action animations so they play instantly (no 2-sec load delay)
		const actions = ['Dance', 'TurnAround', 'Happy', 'Bow', 'FlyingKiss', 'Laugh', 'Shrug', 'Greeting', 'LeanForward', 'RomanticPose', 'Cry'];
		const preloadPromises: Promise<any>[] = [];

		for (const name of essentials) {
			const paths = ANIMATION_MAP[name];
			if (!paths || paths.length === 0) continue;

			if (name === 'Talking') {
				// Preload ALL talking variants so gestures are always ready
				for (const path of paths) {
					preloadPromises.push(this.loadAnimationByPath(path, name));
				}
			} else {
				preloadPromises.push(this.loadAnimationByPath(paths[0], name));
			}
		}

		await Promise.allSettled(preloadPromises);

		// Preload action animations in the background (non-blocking)
		for (const name of actions) {
			const paths = ANIMATION_MAP[name];
			if (!paths || paths.length === 0) continue;
			for (const path of paths) {
				this.loadAnimationByPath(path, name).catch(() => {});
			}
		}
	}

	private async loadAnimationByPath(path: string, name: string): Promise<THREE.AnimationClip | null> {
		if (this.clips.has(path)) return this.clips.get(path)!;

		try {
			const fbx = await this.loader.loadAsync(path);
			if (fbx.animations && fbx.animations.length > 0) {
				const fbxClip = fbx.animations[0];
				fbxClip.name = name;
				const vrmClip = AnimationRetargeter.retargetClip(this.vrm, fbxClip, fbx);
				
				// Send debug info to server
				fetch('/api/debug', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						event: 'LOADED',
						path,
						fbxTrackCount: fbxClip.tracks.length,
						vrmTrackCount: vrmClip.tracks.length,
						tracksSample: vrmClip.tracks.slice(0, 5).map(t => ({ name: t.name, keyframes: t.times.length }))
					})
				}).catch(() => {});

				this.clips.set(path, vrmClip);
				return vrmClip;
			}
		} catch (error: any) {
			console.warn(`Failed to load animation ${name} from ${path}`, error);
			fetch('/api/debug', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ event: 'ERROR', path, error: error?.message || error?.toString() || 'Unknown error' })
			}).catch(() => {});
		}
		return null;
	}

	async playState(stateName: string, fadeDuration: number = 0.5, forceRestart: boolean = false) {
		if (!forceRestart && this.currentState === stateName) return;

		// Capture the intended state for async race-condition detection
		const intendedState = stateName;
		this.currentState = stateName;

		const paths = ANIMATION_MAP[stateName];
		if (!paths || paths.length === 0) {
			if (stateName !== 'Idle') {
				this.playState('Idle', fadeDuration, forceRestart);
			}
			return;
		}

		// Pick a random variant
		let randomPath = paths[Math.floor(Math.random() * paths.length)];

		// If cycling gestures (forceRestart), guarantee we pick a different animation to ensure a smooth crossfade instead of a harsh snap
		if (forceRestart && paths.length > 1 && this.currentPath === randomPath) {
			const otherPaths = paths.filter(p => p !== this.currentPath);
			randomPath = otherPaths[Math.floor(Math.random() * otherPaths.length)];
		}

		if (!forceRestart && this.currentPath === randomPath) return;
		// Update path immediately as well
		this.currentPath = randomPath;
		
		fetch('/api/debug', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ event: 'PLAY_STATE', state: stateName, path: randomPath })
		}).catch(() => {});

		let clip = this.clips.get(randomPath);
		if (!clip) {
			clip = await this.loadAnimationByPath(randomPath, stateName);
		}

		// Race-condition guard: if state changed during async load, abort this transition
		if (this.currentState !== intendedState) return;

		if (!clip) {
			// This specific path failed to load — try another variant
			const fallbackPaths = paths.filter(p => p !== randomPath);
			for (const fbPath of fallbackPaths) {
				const fbClip = this.clips.get(fbPath) || await this.loadAnimationByPath(fbPath, stateName);
				if (this.currentState !== intendedState) return;
				if (fbClip) {
					clip = fbClip;
					randomPath = fbPath;
					this.currentPath = fbPath;
					break;
				}
			}
			if (!clip) {
				if (stateName !== 'Idle') {
					this.playState('Idle', fadeDuration, forceRestart);
				}
				return;
			}
		}

		let action = this.actions.get(randomPath);
		if (!action) {
			action = this.mixer.clipAction(clip);
			this.actions.set(randomPath, action);
		}

		action.reset();
		
		// Adjust looping based on state
		const ONE_SHOT_STATES = ['Wave', 'Greeting', 'TurnAround', 'Bow', 'FlyingKiss', 'Laugh', 'Shrug', 'Happy', 'LeanForward', 'RomanticPose'];
		if (ONE_SHOT_STATES.includes(stateName)) {
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		} else {
			// Dance, Idle, Talking, etc. all loop
			action.setLoop(THREE.LoopRepeat, Infinity);
		}

		action.play();

		if (this.currentAction && this.currentAction !== action) {
			action.crossFadeFrom(this.currentAction, fadeDuration, true);
		}

		this.currentAction = action;
	}

	getCurrentState() {
		return this.currentState;
	}

	update(delta: number) {
		this.mixer.update(delta);
	}

	dispose() {
		this.mixer.stopAllAction();
		this.actions.clear();
		this.clips.clear();
	}
}
