/**
 * AudioAnalysisManager.js
 * Singleton for managing audio state and analysis data across components
 */

import { analyzeAudioFile } from './audioAnalyzer';
import { initializeAdaptiveNormalizer, resetAdaptiveNormalizer } from './adaptiveAudioNormalizer';

class AudioAnalysisManager {
    constructor() {
        // Singleton instance check
        if (AudioAnalysisManager.instance) {
            return AudioAnalysisManager.instance;
        }

        // Initialize state
        this.state = {
            audioFile: null,
            audioAnalysis: null,
            isPlaying: false,
            currentTime: 0,
            isAnalyzing: false,
            isLooping: false,
            listeners: [],
        };

        AudioAnalysisManager.instance = this;
    }

    // Subscribe to state changes
    subscribe(callback) {
        this.state.listeners.push(callback);

        // Immediately call with current state
        callback(this.getState());

        // Return unsubscribe function
        return () => {
            this.state.listeners = this.state.listeners.filter(listener => listener !== callback);
        };
    }

    // Notify all listeners of state change
    notifyListeners() {
        const currentState = this.getState();
        this.state.listeners.forEach(listener => listener(currentState));
    }

    // Get current audio state
    getState() {
        return {
            audioFile: this.state.audioFile,
            audioAnalysis: this.state.audioAnalysis,
            isPlaying: this.state.isPlaying,
            currentTime: this.state.currentTime,
            isAnalyzing: this.state.isAnalyzing,
            isLooping: this.state.isLooping
        };
    }

    // Update currentTime
    setCurrentTime(time) {
        this.state.currentTime = time;
        this.notifyListeners();
    }

    // Set playing state
    setIsPlaying(isPlaying) {
        this.state.isPlaying = isPlaying;
        this.notifyListeners();
    }

    // Set audio file and analyze
    async setAudioFile(file, audioElement) {
        if (!file) return;

        this.state.audioFile = file;
        this.state.isAnalyzing = true;
        this.notifyListeners();

        // Reset adaptive normalizer for new song
        resetAdaptiveNormalizer();

        // Create object URL for audio element if provided
        if (audioElement) {
            const audioUrl = URL.createObjectURL(file);
            audioElement.src = audioUrl;
            audioElement.load();

            // Apply current loop setting to new audio file
            audioElement.loop = this.state.isLooping;
        }

        // Analyze audio file
        try {
            const analysis = await analyzeAudioFile(file);
            this.state.audioAnalysis = analysis;
            console.log('Audio analysis complete:', analysis);

            // Initialize adaptive normalizer with feature history
            if (analysis.featureHistory) {
                const success = initializeAdaptiveNormalizer(analysis.featureHistory);
                console.log('Adaptive normalizer initialized:', success);
            }
        } catch (error) {
            console.error('Error analyzing audio:', error);
        } finally {
            this.state.isAnalyzing = false;
            this.notifyListeners();
        }
    }

    // Toggle play/pause
    togglePlayPause(audioElement) {
        if (!audioElement) return;

        console.log(`[AUDIO MGR] Play button clicked, current state: ${this.state.isPlaying ? 'playing' : 'paused'}`);

        if (this.state.isPlaying) {
            audioElement.pause();
            console.log('[AUDIO MGR] Pausing audio');
        } else {
            audioElement.play();
            console.log('[AUDIO MGR] Starting audio playback');
        }

        this.state.isPlaying = !this.state.isPlaying;
        this.notifyListeners();
    }

    // Add time update listener to audio element
    setupTimeUpdateListener(audioElement) {
        if (!audioElement) return;

        const updateCurrentTime = () => {
            this.setCurrentTime(audioElement.currentTime);
        };

        // Remove any existing listeners first
        audioElement.removeEventListener('timeupdate', updateCurrentTime);

        // Add listener
        audioElement.addEventListener('timeupdate', updateCurrentTime);

        // Return cleanup function
        return () => {
            audioElement.removeEventListener('timeupdate', updateCurrentTime);
        };
    }

    // Skip forward in the audio by specified seconds
    skipForward(audioElement, seconds = 5) {
        if (!audioElement || !this.state.audioFile) return;

        // Calculate new time, ensuring we don't exceed the duration
        const newTime = Math.min(audioElement.duration, audioElement.currentTime + seconds);
        audioElement.currentTime = newTime;
        this.setCurrentTime(newTime);
        console.log(`[AUDIO MGR] Skipped forward to ${newTime.toFixed(2)}s`);
    }

    // Skip backward in the audio by specified seconds
    skipBackward(audioElement, seconds = 5) {
        if (!audioElement || !this.state.audioFile) return;

        // Calculate new time, ensuring we don't go below 0
        const newTime = Math.max(0, audioElement.currentTime - seconds);
        audioElement.currentTime = newTime;
        this.setCurrentTime(newTime);
        console.log(`[AUDIO MGR] Skipped backward to ${newTime.toFixed(2)}s`);
    }

    // Reset audio to the beginning
    resetAudio(audioElement) {
        if (!audioElement || !this.state.audioFile) return;

        // Set the current time to 0
        audioElement.currentTime = 0;
        this.setCurrentTime(0);
        console.log(`[AUDIO MGR] Reset audio to beginning`);
    }

    // Toggle looping state
    toggleLooping(audioElement) {
        if (!audioElement || !this.state.audioFile) return;

        // Toggle the looping state
        this.state.isLooping = !this.state.isLooping;

        // If we have an audio element, set its loop property accordingly
        if (audioElement) {
            audioElement.loop = this.state.isLooping;
        }

        console.log(`[AUDIO MGR] Looping ${this.state.isLooping ? 'enabled' : 'disabled'}`);
        this.notifyListeners();
    }

    // Setup ended event listener for auto-replay when looping is enabled
    setupEndedEventListener(audioElement) {
        if (!audioElement) return;

        const handleEnded = () => {
            // If looping is enabled but the native HTML5 loop isn't working for some reason,
            // we'll handle it manually
            if (this.state.isLooping) {
                console.log('[AUDIO MGR] Audio ended, looping enabled - restarting');
                this.resetAudio(audioElement);
                audioElement.play();
            } else {
                // When not looping, just update the playing state when ended
                this.setIsPlaying(false);
                console.log('[AUDIO MGR] Audio ended');
            }
        };

        // Remove any existing listeners first
        audioElement.removeEventListener('ended', handleEnded);

        // Add listener
        audioElement.addEventListener('ended', handleEnded);

        // Return cleanup function
        return () => {
            audioElement.removeEventListener('ended', handleEnded);
        };
    }
}

// Export a singleton instance
export default new AudioAnalysisManager(); 