import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Mixamo to VRM Bone Mapping
const mixamoVRMRigMap = {
	mixamorigHips: 'hips',
	mixamorigLeftArm: 'leftUpperArm',
	mixamorigLeftForeArm: 'leftLowerArm',
	mixamorigLeftHand: 'leftHand'
};

async function testRetargetMath() {
	try {
		const fbxPath = 'c:\\Users\\banar\\Desktop\\AGY\\blancbeu-sveltekit\\static\\animations\\Gestures Pack Basic\\happy hand gesture.fbx';
		const buffer = fs.readFileSync(fbxPath);
		const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

		const loader = new FBXLoader();
		const fbxAsset = loader.parse(arrayBuffer, '');
		const fbxClip = fbxAsset.animations[0];

		// Mock VRM humanoid mapping
		const mockVrmNodes = {};
		Object.values(mixamoVRMRigMap).forEach((vrmBoneName) => {
			mockVrmNodes[vrmBoneName] = new THREE.Object3D();
			mockVrmNodes[vrmBoneName].name = `vrm_normalized_${vrmBoneName}`;
			mockVrmNodes[vrmBoneName].position.set(0, 1.0, 0);
		});

		const mockVrm = {
			humanoid: {
				getNormalizedBoneNode: (boneName) => {
					return mockVrmNodes[boneName] || null;
				}
			},
			meta: {
				metaVersion: '1'
			}
		};

		const restRotationInverse = new THREE.Quaternion();
		const parentRestWorldRotation = new THREE.Quaternion();
		const _quatA = new THREE.Quaternion();

		console.log('--- RETARGET MATH VERIFICATION ---');

		fbxClip.tracks.forEach((track) => {
			const trackSplitted = track.name.split('.');
			const originalRigName = trackSplitted[0];
			const mixamoRigName = originalRigName.replace(':', '');
			const propertyName = trackSplitted[1];

			const vrmBoneName = mixamoVRMRigMap[mixamoRigName];
			if (!vrmBoneName) return;

			const vrmNodeName = mockVrm.humanoid.getNormalizedBoneNode(vrmBoneName)?.name;
			const mixamoRigNode = fbxAsset.getObjectByName(originalRigName);

			if (vrmNodeName != null && mixamoRigNode != null && track instanceof THREE.QuaternionKeyframeTrack) {
				console.log(`\nBone: ${mixamoRigName} -> ${vrmBoneName}`);
				
				// Print input values (first 8 floats / 2 quaternions)
				console.log('  Input times (first 5):', track.times.slice(0, 5));
				console.log('  Input values (first 8):', Array.from(track.values.slice(0, 8)));

				// Store rotations of rest-pose
				mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
				if (mixamoRigNode.parent) {
					mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);
				}

				console.log('  restRotationInverse:', [restRotationInverse.x, restRotationInverse.y, restRotationInverse.z, restRotationInverse.w]);
				console.log('  parentRestWorldRotation:', [parentRestWorldRotation.x, parentRestWorldRotation.y, parentRestWorldRotation.z, parentRestWorldRotation.w]);

				const retargetedValues = new Float32Array(track.values.length);
				for (let i = 0; i < track.values.length; i += 4) {
					_quatA.fromArray(track.values, i);
					_quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
					_quatA.toArray(retargetedValues, i);
				}

				console.log('  Retargeted values (first 8):', Array.from(retargetedValues.slice(0, 8)));
				
				// Validate no NaN
				let hasNaN = false;
				for (let i = 0; i < retargetedValues.length; i++) {
					if (isNaN(retargetedValues[i])) {
						hasNaN = true;
						break;
					}
				}
				console.log('  Has NaN:', hasNaN);
			}
		});

	} catch (e) {
		console.error('Simulation failed:', e);
	}
}

testRetargetMath();
