import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import type { VRM } from '@pixiv/three-vrm';
import { AnimationRetargeter } from './AnimationRetargeter';

const ANIMATION_MAP: Record<string, string[]> = {
	'Idle': [
		'/animations/Happy Idle.fbx',
		'/animations/Happy Idle (1).fbx',
		'/animations/Idle (1).fbx',
		'/animations/Idle.fbx',
		'/animations/Breathing Idle.fbx'
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
		this.mixer = new THREE.AnimationMixer(vrm.scene);
		this.loader = new FBXLoader();
	}

	async preload() {
		// Preload only essential ones to speed up initial load
		const essentials = ['Idle', 'Talking', 'Wave'];
		await Promise.all(essentials.map(name => {
			const paths = ANIMATION_MAP[name];
			if (paths && paths.length > 0) {
				return this.loadAnimationByPath(paths[0], name);
			}
		}));
	}

	private async loadAnimationByPath(path: string, name: string): Promise<THREE.AnimationClip | null> {
		if (this.clips.has(path)) return this.clips.get(path)!;

		try {
			const fbx = await this.loader.loadAsync(path);
			if (fbx.animations && fbx.animations.length > 0) {
				const fbxClip = fbx.animations[0];
				fbxClip.name = name;
				const vrmClip = AnimationRetargeter.retargetClip(this.vrm, fbxClip, fbx);
				this.clips.set(path, vrmClip);
				return vrmClip;
			}
		} catch (error) {
			console.warn(`Failed to load animation ${name} from ${path}`, error);
		}
		return null;
	}

	async playState(stateName: string, fadeDuration: number = 0.5, forceRestart: boolean = false) {
		if (!forceRestart && this.currentState === stateName) return;

		// Immediately update state to prevent async race conditions when called rapidly
		this.currentState = stateName;

		const paths = ANIMATION_MAP[stateName];
		if (!paths || paths.length === 0) {
			if (stateName !== 'Idle') {
				this.playState('Idle', fadeDuration, forceRestart);
			}
			return;
		}

		// Pick a random variant
		const randomPath = paths[Math.floor(Math.random() * paths.length)];

		if (!forceRestart && this.currentPath === randomPath) return;
		// Update path immediately as well
		this.currentPath = randomPath;

		let clip = this.clips.get(randomPath);
		if (!clip) {
			clip = await this.loadAnimationByPath(randomPath, stateName);
		}

		if (!clip) {
			if (stateName !== 'Idle') {
				this.playState('Idle', fadeDuration, forceRestart);
			}
			return;
		}

		let action = this.actions.get(randomPath);
		if (!action) {
			action = this.mixer.clipAction(clip);
			this.actions.set(randomPath, action);
		}

		action.reset();
		
		// Adjust looping based on state
		if (['Wave', 'Greeting', 'TurnAround', 'Bow', 'FlyingKiss', 'Laugh', 'Shrug', 'Happy', 'LeanForward', 'RomanticPose'].includes(stateName)) {
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		} else {
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
