import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import type { VRM } from '@pixiv/three-vrm';
import { AnimationRetargeter } from './AnimationRetargeter';

const ANIMATION_MAP: Record<string, string> = {
	'Idle': '/animations/Happy Idle.fbx',
	'BreathingIdle': '/animations/Breathing Idle.fbx',
	'Talking': '/animations/Talking.fbx',
	'Talking1': '/animations/Talking (1).fbx',
	'Talking2': '/animations/Talking (2).fbx',
	'Wave': '/animations/Waving.fbx',
	'Greeting': '/animations/Standing Greeting.fbx',
	'Happy': '/animations/Happy.fbx',
	'Thinking': '/animations/Thinking.fbx',
	'Dance': '/animations/Dancing.fbx',
	'TurnAround': '/animations/180 Turn W_ Briefcase.fbx',
	'Bow': '/animations/Female Dance Pose.fbx',
	'Sit': '/animations/Female Sitting Pose.fbx',
	'Laugh': '/animations/Happy (1).fbx',
	'Cry': '/animations/Crying.fbx',
	'StandCasual': '/animations/Female Standing Pose.fbx',
	'Shrug': '/animations/No.fbx',
	'RomanticPose': '/animations/Female Dynamic Pose.fbx',
	'LeanForward': '/animations/Female Start Walking.fbx',
	'FlyingKiss': '/animations/Kiss.fbx'
};

export class AnimationManager {
	private mixer: THREE.AnimationMixer;
	private vrm: VRM;
	private loader: FBXLoader;
	private clips: Map<string, THREE.AnimationClip> = new Map();
	private actions: Map<string, THREE.AnimationAction> = new Map();
	private currentAction: THREE.AnimationAction | null = null;
	private currentState: string = '';

	constructor(vrm: VRM) {
		this.vrm = vrm;
		this.mixer = new THREE.AnimationMixer(vrm.scene);
		this.loader = new FBXLoader();
	}

	async preload() {
		// Preload only essential ones to speed up initial load
		const essentials = ['Idle', 'Talking', 'Wave'];
		await Promise.all(essentials.map(name => this.loadAnimation(name)));
	}

	private async loadAnimation(name: string): Promise<THREE.AnimationClip | null> {
		if (this.clips.has(name)) return this.clips.get(name)!;

		const path = ANIMATION_MAP[name];
		if (!path) return null;

		try {
			const fbx = await this.loader.loadAsync(path);
			if (fbx.animations && fbx.animations.length > 0) {
				const fbxClip = fbx.animations[0];
				fbxClip.name = name;
				const vrmClip = AnimationRetargeter.retargetClip(this.vrm, fbxClip, fbx);
				this.clips.set(name, vrmClip);
				return vrmClip;
			}
		} catch (error) {
			console.warn(`Failed to load animation ${name} from ${path}`, error);
		}
		return null;
	}

	async playState(stateName: string, fadeDuration: number = 0.5) {
		if (this.currentState === stateName) return;

		let clip = this.clips.get(stateName);
		if (!clip) {
			clip = await this.loadAnimation(stateName);
		}

		if (!clip) {
			// Fallback to Idle
			if (stateName !== 'Idle') {
				this.playState('Idle', fadeDuration);
			}
			return;
		}

		let action = this.actions.get(stateName);
		if (!action) {
			action = this.mixer.clipAction(clip);
			this.actions.set(stateName, action);
		}

		action.reset();
		
		// Adjust looping based on state
		if (['Wave', 'Greeting', 'TurnAround', 'Bow', 'FlyingKiss', 'Laugh', 'Shrug', 'Happy'].includes(stateName)) {
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		} else {
			action.setLoop(THREE.LoopRepeat, Infinity);
		}

		action.play();

		if (this.currentAction) {
			action.crossFadeFrom(this.currentAction, fadeDuration, true);
		}

		this.currentAction = action;
		this.currentState = stateName;
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
