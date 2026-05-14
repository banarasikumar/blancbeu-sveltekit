import * as THREE from 'three';
import { VRMHumanBoneName, type VRM } from '@pixiv/three-vrm';

/**
 * Mixamo to VRM Bone Mapping
 */
export const mixamoVRMRigMap: Record<string, VRMHumanBoneName> = {
	mixamorigHips: VRMHumanBoneName.Hips,
	mixamorigSpine: VRMHumanBoneName.Spine,
	mixamorigSpine1: VRMHumanBoneName.Chest,
	mixamorigSpine2: VRMHumanBoneName.UpperChest,
	mixamorigNeck: VRMHumanBoneName.Neck,
	mixamorigHead: VRMHumanBoneName.Head,
	mixamorigLeftShoulder: VRMHumanBoneName.LeftShoulder,
	mixamorigLeftArm: VRMHumanBoneName.LeftUpperArm,
	mixamorigLeftForeArm: VRMHumanBoneName.LeftLowerArm,
	mixamorigLeftHand: VRMHumanBoneName.LeftHand,
	mixamorigRightShoulder: VRMHumanBoneName.RightShoulder,
	mixamorigRightArm: VRMHumanBoneName.RightUpperArm,
	mixamorigRightForeArm: VRMHumanBoneName.RightLowerArm,
	mixamorigRightHand: VRMHumanBoneName.RightHand,
	mixamorigLeftUpLeg: VRMHumanBoneName.LeftUpperLeg,
	mixamorigLeftLeg: VRMHumanBoneName.LeftLowerLeg,
	mixamorigLeftFoot: VRMHumanBoneName.LeftFoot,
	mixamorigLeftToeBase: VRMHumanBoneName.LeftToes,
	mixamorigRightUpLeg: VRMHumanBoneName.RightUpperLeg,
	mixamorigRightLeg: VRMHumanBoneName.RightLowerLeg,
	mixamorigRightFoot: VRMHumanBoneName.RightFoot,
	mixamorigRightToeBase: VRMHumanBoneName.RightToes,
	mixamorigLeftHandThumb1: VRMHumanBoneName.LeftThumbProximal,
	mixamorigLeftHandThumb2: VRMHumanBoneName.LeftThumbIntermediate,
	mixamorigLeftHandThumb3: VRMHumanBoneName.LeftThumbDistal,
	mixamorigLeftHandIndex1: VRMHumanBoneName.LeftIndexProximal,
	mixamorigLeftHandIndex2: VRMHumanBoneName.LeftIndexIntermediate,
	mixamorigLeftHandIndex3: VRMHumanBoneName.LeftIndexDistal,
	mixamorigLeftHandMiddle1: VRMHumanBoneName.LeftMiddleProximal,
	mixamorigLeftHandMiddle2: VRMHumanBoneName.LeftMiddleIntermediate,
	mixamorigLeftHandMiddle3: VRMHumanBoneName.LeftMiddleDistal,
	mixamorigLeftHandRing1: VRMHumanBoneName.LeftRingProximal,
	mixamorigLeftHandRing2: VRMHumanBoneName.LeftRingIntermediate,
	mixamorigLeftHandRing3: VRMHumanBoneName.LeftRingDistal,
	mixamorigLeftHandPinky1: VRMHumanBoneName.LeftLittleProximal,
	mixamorigLeftHandPinky2: VRMHumanBoneName.LeftLittleIntermediate,
	mixamorigLeftHandPinky3: VRMHumanBoneName.LeftLittleDistal,
	mixamorigRightHandThumb1: VRMHumanBoneName.RightThumbProximal,
	mixamorigRightHandThumb2: VRMHumanBoneName.RightThumbIntermediate,
	mixamorigRightHandThumb3: VRMHumanBoneName.RightThumbDistal,
	mixamorigRightHandIndex1: VRMHumanBoneName.RightIndexProximal,
	mixamorigRightHandIndex2: VRMHumanBoneName.RightIndexIntermediate,
	mixamorigRightHandIndex3: VRMHumanBoneName.RightIndexDistal,
	mixamorigRightHandMiddle1: VRMHumanBoneName.RightMiddleProximal,
	mixamorigRightHandMiddle2: VRMHumanBoneName.RightMiddleIntermediate,
	mixamorigRightHandMiddle3: VRMHumanBoneName.RightMiddleDistal,
	mixamorigRightHandRing1: VRMHumanBoneName.RightRingProximal,
	mixamorigRightHandRing2: VRMHumanBoneName.RightRingIntermediate,
	mixamorigRightHandRing3: VRMHumanBoneName.RightRingDistal,
	mixamorigRightHandPinky1: VRMHumanBoneName.RightLittleProximal,
	mixamorigRightHandPinky2: VRMHumanBoneName.RightLittleIntermediate,
	mixamorigRightHandPinky3: VRMHumanBoneName.RightLittleDistal
};

/**
 * Retargets a Mixamo animation clip to a VRM model.
 * Mixamo models are T-pose, VRM models are T-pose but arms might differ.
 * This class maps tracks correctly.
 */
export class AnimationRetargeter {
	/**
	 * Converts a Mixamo FBX animation clip into a VRM-compatible animation clip.
	 */
	static retargetClip(vrm: VRM, fbxClip: THREE.AnimationClip, mixamoRig: THREE.Group): THREE.AnimationClip {
		const tracks: THREE.KeyframeTrack[] = [];
		const humanoid = vrm.humanoid;
		if (!humanoid) return fbxClip;

		// Ensure world matrices are computed for the rest pose before reading them
		mixamoRig.updateMatrixWorld(true);

		const positionScale = 0.01;

		fbxClip.tracks.forEach((track) => {
			const trackSplits = track.name.split('.');
			const mixamoBoneName = trackSplits[0];
			const propertyName = trackSplits[1];

			const vrmBoneName = mixamoVRMRigMap[mixamoBoneName];
			if (!vrmBoneName) return;

			const vrmNode = humanoid.getNormalizedBoneNode(vrmBoneName);
			const mixamoNode = mixamoRig.getObjectByName(mixamoBoneName);
			if (!vrmNode || !mixamoNode) return;

			if (track instanceof THREE.QuaternionKeyframeTrack) {
				const restRotationInverse = new THREE.Quaternion();
				const parentRestWorldRotation = new THREE.Quaternion();

				mixamoNode.getWorldQuaternion(restRotationInverse).invert();
				if (mixamoNode.parent) {
					mixamoNode.parent.getWorldQuaternion(parentRestWorldRotation);
				}

				const values = new Float32Array(track.values.length);
				const _q = new THREE.Quaternion();

				for (let i = 0; i < track.values.length; i += 4) {
					_q.fromArray(track.values, i);
					_q.premultiply(parentRestWorldRotation);
					_q.multiply(restRotationInverse);
					_q.toArray(values, i);
				}

				const newTrack = new THREE.QuaternionKeyframeTrack(
					`${vrmNode.uuid}.quaternion`,
					track.times,
					values
				);
				tracks.push(newTrack);
			} else if (track instanceof THREE.VectorKeyframeTrack) {
				if (vrmBoneName === VRMHumanBoneName.Hips) {
					const scaledValues = new Float32Array(track.values.length);
					for (let i = 0; i < track.values.length; i++) {
						scaledValues[i] = track.values[i] * positionScale;
					}

					const newTrack = new THREE.VectorKeyframeTrack(
						`${vrmNode.uuid}.position`,
						track.times,
						scaledValues
					);
					tracks.push(newTrack);
				}
			}
		});

		const newClip = new THREE.AnimationClip(fbxClip.name, fbxClip.duration, tracks);
		return newClip;
	}
}
