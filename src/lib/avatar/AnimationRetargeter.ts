import * as THREE from 'three';
import { VRMHumanBoneName, type VRM } from '@pixiv/three-vrm';

/**
 * Mixamo to VRM Bone Mapping (using string bone names as per official pixiv example)
 */
export const mixamoVRMRigMap: Record<string, string> = {
	mixamorigHips: 'hips',
	mixamorigSpine: 'spine',
	mixamorigSpine1: 'chest',
	mixamorigSpine2: 'upperChest',
	mixamorigNeck: 'neck', // Re-enabled so she nods and moves her head naturally
	mixamorigHead: 'head', // Re-enabled so she nods and moves her head naturally
	mixamorigLeftShoulder: 'leftShoulder',
	mixamorigLeftArm: 'leftUpperArm',
	mixamorigLeftForeArm: 'leftLowerArm',
	mixamorigLeftHand: 'leftHand',
	mixamorigLeftHandThumb1: 'leftThumbMetacarpal',
	mixamorigLeftHandThumb2: 'leftThumbProximal',
	mixamorigLeftHandThumb3: 'leftThumbDistal',
	mixamorigLeftHandIndex1: 'leftIndexProximal',
	mixamorigLeftHandIndex2: 'leftIndexIntermediate',
	mixamorigLeftHandIndex3: 'leftIndexDistal',
	mixamorigLeftHandMiddle1: 'leftMiddleProximal',
	mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
	mixamorigLeftHandMiddle3: 'leftMiddleDistal',
	mixamorigLeftHandRing1: 'leftRingProximal',
	mixamorigLeftHandRing2: 'leftRingIntermediate',
	mixamorigLeftHandRing3: 'leftRingDistal',
	mixamorigLeftHandPinky1: 'leftLittleProximal',
	mixamorigLeftHandPinky2: 'leftLittleIntermediate',
	mixamorigLeftHandPinky3: 'leftLittleDistal',
	mixamorigRightShoulder: 'rightShoulder',
	mixamorigRightArm: 'rightUpperArm',
	mixamorigRightForeArm: 'rightLowerArm',
	mixamorigRightHand: 'rightHand',
	mixamorigRightHandPinky1: 'rightLittleProximal',
	mixamorigRightHandPinky2: 'rightLittleIntermediate',
	mixamorigRightHandPinky3: 'rightLittleDistal',
	mixamorigRightHandRing1: 'rightRingProximal',
	mixamorigRightHandRing2: 'rightRingIntermediate',
	mixamorigRightHandRing3: 'rightRingDistal',
	mixamorigRightHandMiddle1: 'rightMiddleProximal',
	mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
	mixamorigRightHandMiddle3: 'rightMiddleDistal',
	mixamorigRightHandIndex1: 'rightIndexProximal',
	mixamorigRightHandIndex2: 'rightIndexIntermediate',
	mixamorigRightHandIndex3: 'rightIndexDistal',
	mixamorigRightHandThumb1: 'rightThumbMetacarpal',
	mixamorigRightHandThumb2: 'rightThumbProximal',
	mixamorigRightHandThumb3: 'rightThumbDistal',
	mixamorigLeftUpLeg: 'leftUpperLeg',
	mixamorigLeftLeg: 'leftLowerLeg',
	mixamorigLeftFoot: 'leftFoot',
	mixamorigLeftToeBase: 'leftToes',
	mixamorigRightUpLeg: 'rightUpperLeg',
	mixamorigRightLeg: 'rightLowerLeg',
	mixamorigRightFoot: 'rightFoot',
	mixamorigRightToeBase: 'rightToes'
};

/**
 * Retargets a Mixamo FBX animation clip to a VRM model.
 * Based on the official pixiv/three-vrm loadMixamoAnimation example.
 */
export class AnimationRetargeter {
	/**
	 * Converts a Mixamo FBX animation clip into a VRM-compatible animation clip.
	 * This follows the exact algorithm from the official pixiv three-vrm example.
	 */
	public static retargetClip(vrm: VRM, fbxClip: THREE.AnimationClip, fbxAsset: THREE.Group): THREE.AnimationClip {
		const tracks: THREE.KeyframeTrack[] = [];

		const restRotationInverse = new THREE.Quaternion();
		const parentRestWorldRotation = new THREE.Quaternion();
		const _quatA = new THREE.Quaternion();
		const _vec3 = new THREE.Vector3();

		// Adjust with reference to hips height
		let motionHipsNode: THREE.Object3D | null = null;
		fbxAsset.traverse((node) => {
			if (node.name.replace(':', '').startsWith('mixamorigHips')) {
				motionHipsNode = node;
			}
		});
		const vrmHipsY = vrm.humanoid?.getNormalizedBoneNode('hips' as VRMHumanBoneName)?.position?.y ?? 1;
		const motionHipsY = motionHipsNode?.position?.y ?? 100;
		const hipsPositionScale = vrmHipsY / motionHipsY;

		const knownMixamoNames = Object.keys(mixamoVRMRigMap).sort((a, b) => b.length - a.length);

		fbxClip.tracks.forEach((track) => {
			const trackSplitted = track.name.split('.');
			const originalRigName = trackSplitted[0];
			
			// Normalize Mixamo rig name (e.g. "mixamorig:LeftArmModelSLimbNode" -> "mixamorigLeftArm")
			let mixamoRigName = originalRigName.replace(':', '');
			const matchedName = knownMixamoNames.find(name => mixamoRigName.startsWith(name));
			if (matchedName) {
				mixamoRigName = matchedName;
			}

			const propertyName = trackSplitted[1];

			const vrmBoneName = mixamoVRMRigMap[mixamoRigName];
			if (!vrmBoneName) return;

			const vrmNodeName = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName as VRMHumanBoneName)?.name;
			
			let mixamoRigNode: THREE.Object3D | null = null;
			fbxAsset.traverse((node) => {
				const nodeNameClean = node.name.replace(':', '');
				if (node.name === originalRigName || nodeNameClean.startsWith(mixamoRigName)) {
					mixamoRigNode = node;
				}
			});

			if (vrmNodeName != null && mixamoRigNode != null) {
				// Store rotations of rest-pose
				mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
				if (mixamoRigNode.parent) {
					mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);
				}

				if (track instanceof THREE.QuaternionKeyframeTrack) {
					// Retarget rotation of mixamoRig to NormalizedBone
					for (let i = 0; i < track.values.length; i += 4) {
						const flatQuaternion = track.values.slice(i, i + 4);

						_quatA.fromArray(flatQuaternion);

						// parentRestWorldRotation * trackRotation * restRotationInverse
						_quatA
							.premultiply(parentRestWorldRotation)
							.multiply(restRotationInverse);

						_quatA.toArray(flatQuaternion);

						flatQuaternion.forEach((v, index) => {
							track.values[index + i] = v;
						});
					}

					tracks.push(
						new THREE.QuaternionKeyframeTrack(
							`${vrmNodeName}.${propertyName}`,
							track.times,
							track.values.map((v, i) => (vrm.meta?.metaVersion === '0' && i % 2 === 0 ? -v : v)),
						),
					);
				} else if (track instanceof THREE.VectorKeyframeTrack) {
					// IMPORTANT: Only the hips bone is allowed to have position changes in VRM!
					// If we apply Mixamo position tracks to other bones (like hands/arms), it will rip the mesh apart and hide the hands.
					if (vrmBoneName === 'hips') {
						const value = track.values.map((v, i) => (vrm.meta?.metaVersion === '0' && i % 3 !== 1 ? -v : v) * hipsPositionScale);
						tracks.push(new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, value));
					}
				}
			}
		});

		return new THREE.AnimationClip(fbxClip.name, fbxClip.duration, tracks);
	}
}
