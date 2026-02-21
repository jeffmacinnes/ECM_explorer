import { writable } from 'svelte/store';

const CROSSFADE_MS = 800;
const CROSSFADE_STEPS = 20;

// Stores
export const playingTrack = writable(null); // { albumId, trackIndex, title, previewUrl }
export const isPlaying = writable(false);
export const playbackProgress = writable(0); // 0-1

// Two Audio elements for crossfade
let audioA = null;
let audioB = null;
let activeAudio = null; // points to whichever is currently playing
let rafId = null;

const ensureAudioElements = () => {
	if (!audioA) {
		audioA = new Audio();
		audioB = new Audio();
		audioA.volume = 0;
		audioB.volume = 0;
	}
};

const getInactiveAudio = () => {
	return activeAudio === audioA ? audioB : audioA;
};

const updateProgress = () => {
	if (activeAudio && activeAudio.duration) {
		playbackProgress.set(activeAudio.currentTime / activeAudio.duration);
	}
	rafId = requestAnimationFrame(updateProgress);
};

const startProgressLoop = () => {
	if (rafId) cancelAnimationFrame(rafId);
	rafId = requestAnimationFrame(updateProgress);
};

const stopProgressLoop = () => {
	if (rafId) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	playbackProgress.set(0);
};

// Crossfade: ramp newAudio up and oldAudio down over CROSSFADE_MS
const crossfade = (newAudio, oldAudio) => {
	const stepMs = CROSSFADE_MS / CROSSFADE_STEPS;
	let step = 0;

	const interval = setInterval(() => {
		step++;
		const t = step / CROSSFADE_STEPS;
		newAudio.volume = Math.min(1, t);
		if (oldAudio) oldAudio.volume = Math.max(0, 1 - t);

		if (step >= CROSSFADE_STEPS) {
			clearInterval(interval);
			newAudio.volume = 1;
			if (oldAudio) {
				oldAudio.volume = 0;
				oldAudio.pause();
				oldAudio.currentTime = 0;
			}
		}
	}, stepMs);
};

export const playTrack = (albumId, trackIndex, title, previewUrl) => {
	if (!previewUrl) return;
	ensureAudioElements();

	const newAudio = activeAudio ? getInactiveAudio() : audioA;
	const oldAudio = activeAudio;

	newAudio.src = previewUrl;
	newAudio.volume = oldAudio ? 0 : 1;

	const onCanPlay = () => {
		newAudio.removeEventListener('canplay', onCanPlay);
		newAudio.play().catch(() => {});
		if (oldAudio) {
			crossfade(newAudio, oldAudio);
		}
		activeAudio = newAudio;
		playingTrack.set({ albumId, trackIndex, title, previewUrl });
		isPlaying.set(true);
		startProgressLoop();
	};

	newAudio.addEventListener('canplay', onCanPlay);

	// Auto-stop when clip ends
	newAudio.onended = () => {
		isPlaying.set(false);
		playingTrack.set(null);
		activeAudio = null;
		stopProgressLoop();
	};

	newAudio.load();
};

export const pauseTrack = () => {
	if (activeAudio) {
		activeAudio.pause();
		isPlaying.set(false);
		stopProgressLoop();
	}
};

export const resumeTrack = () => {
	if (activeAudio && activeAudio.src) {
		activeAudio.play().catch(() => {});
		isPlaying.set(true);
		startProgressLoop();
	}
};

export const stopPlayback = () => {
	if (audioA) {
		audioA.pause();
		audioA.currentTime = 0;
		audioA.volume = 0;
	}
	if (audioB) {
		audioB.pause();
		audioB.currentTime = 0;
		audioB.volume = 0;
	}
	activeAudio = null;
	playingTrack.set(null);
	isPlaying.set(false);
	stopProgressLoop();
};
