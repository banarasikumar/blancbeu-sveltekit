import { writable } from 'svelte/store';
import { storage, db } from '$lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error';

export interface UploadTaskItem {
	id: string;
	fileName: string;
	progress: number;
	status: UploadStatus;
	error?: string;
	downloadUrl?: string;
	type: 'image' | 'file';
}

function createUploadStore() {
	const { subscribe, set, update } = writable<UploadTaskItem[]>([]);

	return {
		subscribe,
		addUpload: (
			file: File,
			storagePath: string,
			docPathToUpdate: string,
			fieldToUpdate: string,
			onComplete?: (url: string) => void
		) => {
			const id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
			const newItem: UploadTaskItem = {
				id,
				fileName: file.name,
				progress: 0,
				status: 'pending',
				type: file.type.startsWith('image/') ? 'image' : 'file'
			};

			update((items) => [newItem, ...items]);

			const storageRef = ref(storage, storagePath);
			const uploadTask = uploadBytesResumable(storageRef, file);

			update((items) =>
				items.map((item) => (item.id === id ? { ...item, status: 'uploading' } : item))
			);

			uploadTask.on(
				'state_changed',
				(snapshot) => {
					const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
					update((items) =>
						items.map((item) => (item.id === id ? { ...item, progress } : item))
					);
				},
				(error: any) => {
					const code = error?.code || '';
					let userMessage = error.message;
					if (code === 'storage/unauthorized') {
						userMessage = 'Permission denied. Check Firebase Storage rules.';
					} else if (code === 'storage/canceled') {
						userMessage = 'Upload was cancelled.';
					} else if (code === 'storage/unknown') {
						userMessage = 'Upload failed. Firebase Storage may not be enabled for this project.';
					} else if (code.includes('storage/bucket-not-found') || code.includes('storage/invalid-url')) {
						userMessage = 'Storage bucket not found. Firebase Storage needs to be set up.';
					}
					console.error(`[UploadStore] Upload failed (${code}):`, error);
					update((items) =>
						items.map((item) =>
							item.id === id ? { ...item, status: 'error', error: userMessage } : item
						)
					);
				},
				async () => {
					try {
						const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
						// Update firestore document
						if (docPathToUpdate) {
							await updateDoc(doc(db, docPathToUpdate), {
								[fieldToUpdate]: downloadUrl,
								isActive: true // Make active when image is uploaded successfully
							});
						}

						update((items) =>
							items.map((item) =>
								item.id === id
									? { ...item, status: 'completed', progress: 100, downloadUrl }
									: item
							)
						);

						if (onComplete) onComplete(downloadUrl);
					} catch (err: any) {
						console.error('[UploadStore] Post-upload update failed:', err);
						update((items) =>
							items.map((item) =>
								item.id === id ? { ...item, status: 'error', error: err.message } : item
							)
						);
					}
				}
			);

			return id;
		},
		removeUpload: (id: string) => update((items) => items.filter((item) => item.id !== id)),
		clearCompleted: () => update((items) => items.filter((item) => item.status !== 'completed'))
	};
}

export const uploadStore = createUploadStore();
