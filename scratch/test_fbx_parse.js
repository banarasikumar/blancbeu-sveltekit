import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const ANIM_DIR = 'c:\\Users\\banar\\Desktop\\AGY\\blancbeu-sveltekit\\static\\animations';

function getFiles(dir) {
	let results = [];
	const list = fs.readdirSync(dir);
	list.forEach((file) => {
		const fullPath = path.join(dir, file);
		const stat = fs.statSync(fullPath);
		if (stat && stat.isDirectory()) {
			results = results.concat(getFiles(fullPath));
		} else if (file.endsWith('.fbx') && file !== 'X Bot.fbx') {
			results.push(fullPath);
		}
	});
	return results;
}

async function run() {
	const loader = new FBXLoader();
	const files = getFiles(ANIM_DIR);
	console.log(`Found ${files.length} FBX files to check.\n`);

	let colonsInTracks = 0;
	let colonsInBones = 0;
	let totalChecked = 0;

	for (const file of files) {
		try {
			const buffer = fs.readFileSync(file);
			const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
			const fbx = loader.parse(arrayBuffer, '');
			
			let hasColonTrack = false;
			if (fbx.animations && fbx.animations.length > 0) {
				const clip = fbx.animations[0];
				for (const track of clip.tracks) {
					if (track.name.includes(':')) {
						hasColonTrack = true;
						break;
					}
				}
			}

			let hasColonBone = false;
			fbx.traverse((child) => {
				if (child.name.includes(':')) {
					hasColonBone = true;
				}
			});

			if (hasColonTrack) colonsInTracks++;
			if (hasColonBone) colonsInBones++;
			totalChecked++;

			if (hasColonTrack || hasColonBone) {
				console.log(`File with colons: ${path.relative(ANIM_DIR, file)}`);
				console.log(`  Has colon in tracks: ${hasColonTrack}`);
				console.log(`  Has colon in bones: ${hasColonBone}`);
			}
		} catch (e) {
			console.error(`Failed to parse ${file}:`, e.message);
		}
	}

	console.log('\n--- SCAN RESULTS ---');
	console.log(`Total Checked: ${totalChecked}`);
	console.log(`Files with colons in tracks: ${colonsInTracks}`);
	console.log(`Files with colons in bones: ${colonsInBones}`);
}

run();
