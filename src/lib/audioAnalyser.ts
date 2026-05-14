/**
 * AudioAnalyser — Utility to play audio buffers and extract real-time volume
 * for driving VRM mouth animation.
 *
 * Uses Web Audio API AnalyserNode to compute normalized amplitude (0..1).
 */
export class AudioAnalyser {
	private ctx: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private source: AudioBufferSourceNode | null = null;
	private gainNode: GainNode | null = null;
	private dataArray: Uint8Array | null = null;
	private _isPlaying = false;

	private nextStartTime = 0;
	private activeSources: AudioBufferSourceNode[] = [];

	get isPlaying(): boolean {
		return this._isPlaying;
	}

	/** Ensure an AudioContext is available (must be called from a user gesture context) */
	private ensureContext(): AudioContext {
		if (!this.ctx || this.ctx.state === 'closed') {
			this.ctx = new AudioContext();
		}
		if (this.ctx.state === 'suspended') {
			this.ctx.resume();
		}
		return this.ctx;
	}

	/**
	 * Queue raw PCM 16-bit LE audio data to play seamlessly after the current buffer.
	 * Returns a promise that resolves when this specific chunk finishes playing.
	 */
	async enqueuePcm(pcmBase64: string, sampleRate = 24000): Promise<void> {
		const ctx = this.ensureContext();

		// Decode base64 to raw bytes
		const binaryString = atob(pcmBase64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}

		// Convert Int16 PCM to Float32
		const int16 = new Int16Array(bytes.buffer);
		const float32 = new Float32Array(int16.length);
		for (let i = 0; i < int16.length; i++) {
			float32[i] = int16[i] / 32768;
		}

		// Create AudioBuffer
		const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
		audioBuffer.copyToChannel(float32, 0);

		if (!this.analyser) {
			this.analyser = ctx.createAnalyser();
			this.analyser.fftSize = 256;
			this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
			
			if (!this.gainNode) {
				this.gainNode = ctx.createGain();
				this.gainNode.gain.value = 1.0;
			}
			
			this.analyser.connect(this.gainNode);
			this.gainNode.connect(ctx.destination);
		}

		const source = ctx.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(this.analyser);
		this.activeSources.push(source);

		const currentTime = ctx.currentTime;
		if (this.nextStartTime < currentTime) {
			this.nextStartTime = currentTime + 0.05; // Slight buffer to prevent glitch
		}

		this._isPlaying = true;
		const scheduledStart = this.nextStartTime;
		this.nextStartTime += audioBuffer.duration;

		return new Promise<void>((resolve) => {
			source.onended = () => {
				// Remove this source from active list
				this.activeSources = this.activeSources.filter(s => s !== source);
				
				// If no more sources are scheduled to play after this one, we are done playing
				if (ctx.currentTime >= this.nextStartTime - 0.1) {
					this._isPlaying = false;
				}
				resolve();
			};
			source.start(scheduledStart);
		});
	}

	/** Play PCM (retained for backward compatibility, though enqueuePcm is preferred) */
	async playPcm(pcmBase64: string, sampleRate = 24000): Promise<void> {
		this.stop();
		return this.enqueuePcm(pcmBase64, sampleRate);
	}

	/** Get the current normalized audio volume (0..1) */
	getVolume(): number {
		if (!this.analyser || !this.dataArray || !this._isPlaying) return 0;

		this.analyser.getByteTimeDomainData(this.dataArray);

		// Compute RMS amplitude
		let sum = 0;
		for (let i = 0; i < this.dataArray.length; i++) {
			const v = (this.dataArray[i] - 128) / 128;
			sum += v * v;
		}
		const rms = Math.sqrt(sum / this.dataArray.length);

		// Normalize and clamp — amplify for better mouth range
		return Math.min(1, rms * 3);
	}

	/** Set the playback volume (0..1) */
	setVolume(value: number): void {
		if (this.gainNode) {
			this.gainNode.gain.value = Math.max(0, Math.min(1, value));
		}
	}

	/** Mute or unmute */
	setMuted(muted: boolean): void {
		if (this.gainNode) {
			this.gainNode.gain.value = muted ? 0 : 1;
		}
	}

	/** Stop current playback */
	stop(): void {
		try {
			if (this.source) {
				this.source.stop();
				this.source.disconnect();
			}
			for (const s of this.activeSources) {
				s.stop();
				s.disconnect();
			}
		} catch {
			// ignore
		}
		this.source = null;
		this.activeSources = [];
		this.nextStartTime = 0;
		this._isPlaying = false;
	}

	/** Fully dispose all resources */
	dispose(): void {
		this.stop();
		if (this.analyser) this.analyser.disconnect();
		if (this.gainNode) this.gainNode.disconnect();
		if (this.ctx && this.ctx.state !== 'closed') {
			this.ctx.close();
		}
		this.ctx = null;
		this.analyser = null;
		this.gainNode = null;
		this.dataArray = null;
	}
}
