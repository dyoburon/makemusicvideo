/**
 * Audio feature analyzer using Meyda.js
 * Extracts significant events, features and timestamps from audio files
 * For use with animation synchronization
 */

// We'll need to install meyda as a dependency:
// npm install meyda --save

import Meyda from 'meyda';

export class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.audioSource = null;
        this.meydaAnalyzer = null;
        this.isAnalyzing = false;
        this.results = {
            drops: [],
            beats: [],
            energyPeaks: [],
            spectrumEvents: [],
            rhythmMarkers: [],
            lowFrequencyEvents: [],
            // Replace drum detection with more general approaches
            transients: [],        // For onset detection (replacing kicks/snares/hi-hats)
            beatGrid: [],          // Regular beat grid based on tempo
            // Keep other event types
            midRangeEvents: [],
            highFrequencyEvents: [],
            timbreChanges: [],
            dynamicChanges: []
        };

        // Cache for more efficient re-analysis
        this.cachedData = {
            audioBuffer: null,
            featureHistory: null,
            rawTransients: []
        };

        // Analysis settings
        this.settings = {
            fftSize: 2048,
            bufferSize: 512,
            hopSize: 512,  // Doubled for performance (~11.6ms resolution, still fine for music)
            energyThreshold: 0.7,
            spectralFluxThreshold: 2.0,
            lowFrequencyThreshold: 0.8,
            beatSensitivity: 1.5,
            analysisWindowSize: 5, // Number of frames to compare for trends
            minTimeBetweenEvents: 0.3, // Seconds between same type of events

            // Onset detection settings
            onsetThreshold: 1.5,        // General onset threshold (used as fallback)
            onsetMinInterval: 0.0,     // Minimum time between transients

            // Band-specific onset thresholds
            lowFreqOnsetThreshold: 1.212,   // Threshold for low frequency transients (bass, kicks)
            midFreqOnsetThreshold: 1.158,   // Threshold for mid frequency transients (snares, vocals)
            highFreqOnsetThreshold: 1.622,  // Threshold for high frequency transients (hi-hats, cymbals)

            // Frequency band ranges (in Bark scale indices, approx.)
            lowBandRange: [0, 3],     // ~20-250Hz (kick drums, bass)
            midBandRange: [4, 12],    // ~250Hz-2kHz (snares, vocals)
            highBandRange: [13, 23],  // ~2kHz-8kHz (hi-hats, cymbals)

            // Dynamic change thresholds
            moderateChangeThreshold: 1.3,
            significantChangeThreshold: 1.8,
            dramaticChangeThreshold: 2.5,

            // Timbral change threshold
            timbreChangeThreshold: 0.15
        };

        // For tracking changes over time
        this.featureHistory = {
            energy: [],
            spectralFlux: [],
            loudness: [],
            spectralFlatness: [],
            rms: [],
            lowBandEnergy: [],
            midBandEnergy: [],
            highBandEnergy: []
        };

        // Save previous buffer for spectralFlux calculation
        this.previousInputData = null;

        // For tracking beats and tempo
        this.beatTracker = {
            lastBeatTime: 0,
            beatIntervals: [],
            confidence: 0,
            tempo: 0
        };
    }

    /**
     * Initialize the audio context and analyzer
     */
    init() {
        // Initialize Web Audio API
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.settings.fftSize;

        // Configure analyzer
        this.analyser.smoothingTimeConstant = 0.5;
        this.analyser.connect(this.audioContext.destination);

        console.log('Audio analyzer initialized');
    }

    /**
     * Load and analyze an audio file
     * @param {String|File} audioFile - Path to audio file or File object
     * @returns {Promise} - Resolves with analysis results
     */
    async analyzeFile(audioFile) {
        if (!this.audioContext) {
            this.init();
        }

        try {
            const totalStartTime = performance.now();
            console.log('[PERF] === FULL ANALYSIS PIPELINE START ===');

            // Reset results
            this.resetResults();

            // Reset previous data
            this.previousInputData = null;

            // Load audio file
            console.log('[PERF] Loading audio file...');
            const loadStartTime = performance.now();
            const audioBuffer = await this.loadAudioFile(audioFile);
            console.log(`[PERF] File loaded in ${((performance.now() - loadStartTime) / 1000).toFixed(2)}s`);
            console.log(`[PERF] Audio duration: ${audioBuffer.duration.toFixed(2)}s, Sample rate: ${audioBuffer.sampleRate}`);

            // Cache the audio buffer for potential reuse
            this.cachedData.audioBuffer = audioBuffer;

            // Store audio data for waveform visualization
            console.log('[PERF] Extracting waveform data...');
            const waveformStartTime = performance.now();
            this.extractWaveformData(audioBuffer);
            console.log(`[PERF] Waveform extracted in ${((performance.now() - waveformStartTime) / 1000).toFixed(2)}s`);

            // Perform offline analysis for better performance
            console.log('[PERF] Starting main analysis...');
            await this.runOfflineAnalysis(audioBuffer);

            // Cache raw transients before processing
            this.cachedData.rawTransients = [...this.results.transients];

            // Process the collected data to find significant events
            console.log('[PERF] Processing results...');
            const processStartTime = performance.now();
            this.processAnalysisResults();
            console.log(`[PERF] Results processed in ${((performance.now() - processStartTime) / 1000).toFixed(2)}s`);

            console.log(`[PERF] === FULL ANALYSIS COMPLETE: ${((performance.now() - totalStartTime) / 1000).toFixed(2)}s ===`);

            return this.results;
        } catch (error) {
            console.error('Error analyzing audio file:', error);
            throw error;
        }
    }

    /**
     * Load an audio file and decode it
     * @param {String|File} audioFile - Path to audio file or File object
     * @returns {Promise<AudioBuffer>} - The decoded audio buffer
     */
    async loadAudioFile(audioFile) {
        let audioData;

        if (typeof audioFile === 'string') {
            // Load from URL
            const response = await fetch(audioFile);
            audioData = await response.arrayBuffer();
        } else if (audioFile instanceof File) {
            // Load from File object
            audioData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsArrayBuffer(audioFile);
            });
        } else {
            throw new Error('Invalid audio file format');
        }

        // Decode the audio data
        return await this.audioContext.decodeAudioData(audioData);
    }

    /**
     * Run offline analysis on the audio buffer
     * @param {AudioBuffer} audioBuffer - The decoded audio buffer
     */
    async runOfflineAnalysis(audioBuffer) {
        const analysisStartTime = performance.now();
        console.log('=== AUDIO ANALYSIS DEBUG START ===');
        console.log(`[PERF] Starting offline analysis...`);
        console.log(`[PERF] Audio duration: ${audioBuffer.duration.toFixed(2)}s`);
        console.log(`[PERF] Sample rate: ${audioBuffer.sampleRate}`);
        console.log(`[PERF] Total samples: ${audioBuffer.length}`);
        this.isAnalyzing = true;

        // Create an offline audio context for faster processing
        const ctxStartTime = performance.now();
        const offlineContext = new OfflineAudioContext({
            numberOfChannels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            sampleRate: audioBuffer.sampleRate
        });

        // Create a buffer source
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;

        // Create an analyzer node
        const analyser = offlineContext.createAnalyser();
        analyser.fftSize = this.settings.fftSize;

        // Connect the source to the analyzer
        source.connect(analyser);
        analyser.connect(offlineContext.destination);
        console.log(`[PERF] Context setup took: ${(performance.now() - ctxStartTime).toFixed(2)}ms`);

        // Set up Meyda features to extract (reduced for performance)
        const meydaFeatures = [
            'energy',           // For energy peaks
            'loudness',         // Essential - provides band energies
            'rms',              // Essential - for transient detection
            'spectralFlatness'  // For timbre changes
        ];

        // Process the audio in chunks
        const bufferSize = this.settings.bufferSize;
        const hopSize = this.settings.hopSize;
        const totalSamples = audioBuffer.length;
        let currentSample = 0;
        const totalIterations = Math.ceil(totalSamples / hopSize);
        console.log(`[PERF] Buffer size: ${bufferSize}, Hop size: ${hopSize}`);
        console.log(`[PERF] Total iterations expected: ${totalIterations}`);

        // Start the source
        source.start();

        // Initialize a simple spectral flux calculator without relying on Meyda's implementation
        let previousSpectrum = null;

        // Performance tracking
        let iterationCount = 0;
        let totalMeydaTime = 0;
        let totalFluxTime = 0;
        let totalStoreTime = 0;
        let slowestMeydaTime = 0;
        let lastLogTime = performance.now();
        const loopStartTime = performance.now();

        // Process the audio in chunks
        while (currentSample < totalSamples && this.isAnalyzing) {
            const iterStartTime = performance.now();
            const currentTime = currentSample / audioBuffer.sampleRate;

            // Get current audio data
            const audioData = this.getAudioDataAtTime(audioBuffer, currentSample, bufferSize);

            try {
                // Extract features with Meyda
                const meydaStartTime = performance.now();
                const features = Meyda.extract(meydaFeatures, audioData);
                const meydaElapsed = performance.now() - meydaStartTime;
                totalMeydaTime += meydaElapsed;
                if (meydaElapsed > slowestMeydaTime) slowestMeydaTime = meydaElapsed;

                // Calculate spectral flux from direct buffer comparison
                const fluxStartTime = performance.now();
                let spectralFlux = 0;

                // Calculate spectral flux if we have previous data
                if (this.previousInputData) {
                    let flux = 0;
                    const prevData = this.previousInputData;

                    // Using direct buffer comparison for simplicity and reliability
                    for (let i = 0; i < audioData.length; i++) {
                        // Look for positive changes in amplitude (onsets)
                        const diff = Math.max(0, Math.abs(audioData[i]) - Math.abs(prevData[i]));
                        flux += diff * diff;
                    }
                    spectralFlux = Math.sqrt(flux);
                }

                this.previousInputData = new Float32Array(audioData);
                totalFluxTime += performance.now() - fluxStartTime;

                // Add spectral flux to features with a minimum value
                features.spectralFlux = Math.max(spectralFlux, 0.01);

                // Log progress every second (real time)
                const now = performance.now();
                if (now - lastLogTime >= 1000) {
                    const elapsed = (now - loopStartTime) / 1000;
                    const progress = ((currentSample / totalSamples) * 100).toFixed(1);
                    const iterPerSec = iterationCount / elapsed;
                    const eta = (totalIterations - iterationCount) / iterPerSec;
                    console.log(`[PERF] Progress: ${progress}% | Iter: ${iterationCount}/${totalIterations} | Speed: ${iterPerSec.toFixed(0)} iter/s | ETA: ${eta.toFixed(1)}s`);
                    console.log(`[PERF]   Avg Meyda: ${(totalMeydaTime/iterationCount).toFixed(3)}ms | Slowest Meyda: ${slowestMeydaTime.toFixed(3)}ms`);
                    lastLogTime = now;
                }

                // Debug logging to help understand detection issues
                if (currentSample % (hopSize * 100) === 0) {
                    console.log('Features at time', currentTime, {
                        lowBandEnergy: features.lowBandEnergy,
                        midBandEnergy: features.midBandEnergy,
                        highBandEnergy: features.highBandEnergy,
                        spectralFlux: features.spectralFlux
                    });
                }

                // Calculate band energies from loudness.specific
                if (features.loudness && features.loudness.specific) {
                    // Calculate energy in different frequency bands
                    const [lowMin, lowMax] = this.settings.lowBandRange;
                    const [midMin, midMax] = this.settings.midBandRange;
                    const [highMin, highMax] = this.settings.highBandRange;

                    // Make sure we don't exceed the available bands
                    const specific = features.loudness.specific;
                    const maxIndex = specific.length - 1;

                    // Calculate band energies
                    features.lowBandEnergy = specific
                        .slice(Math.min(lowMin, maxIndex), Math.min(lowMax, maxIndex) + 1)
                        .reduce((sum, val) => sum + val, 0);

                    features.midBandEnergy = specific
                        .slice(Math.min(midMin, maxIndex), Math.min(midMax, maxIndex) + 1)
                        .reduce((sum, val) => sum + val, 0);

                    features.highBandEnergy = specific
                        .slice(Math.min(highMin, maxIndex), Math.min(highMax, maxIndex) + 1)
                        .reduce((sum, val) => sum + val, 0);
                } else {
                    // Fallback values if loudness.specific is not available
                    features.lowBandEnergy = features.energy * 0.4;  // Approximation
                    features.midBandEnergy = features.energy * 0.3;  // Approximation  
                    features.highBandEnergy = features.energy * 0.3; // Approximation
                }

                // Store features with timestamp
                const storeStartTime = performance.now();
                this.storeEnhancedFeatures(features, currentTime);
                totalStoreTime += performance.now() - storeStartTime;

            } catch (error) {
                console.warn(`Error extracting features at time ${currentTime}:`, error);
                // Continue despite errors to gather as much data as possible
            }

            // Move to next chunk
            currentSample += hopSize;
            iterationCount++;

            // Allow UI thread to breathe on long analyses
            if (iterationCount % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // Final performance summary
        const totalTime = performance.now() - analysisStartTime;
        console.log('=== AUDIO ANALYSIS DEBUG COMPLETE ===');
        console.log(`[PERF] Total analysis time: ${(totalTime / 1000).toFixed(2)}s`);
        console.log(`[PERF] Total iterations: ${iterationCount}`);
        console.log(`[PERF] Avg time per iteration: ${(totalTime / iterationCount).toFixed(3)}ms`);
        console.log(`[PERF] Breakdown:`);
        console.log(`[PERF]   Meyda:     ${(totalMeydaTime / 1000).toFixed(2)}s (${((totalMeydaTime / totalTime) * 100).toFixed(1)}%)`);
        console.log(`[PERF]   Flux calc: ${(totalFluxTime / 1000).toFixed(2)}s (${((totalFluxTime / totalTime) * 100).toFixed(1)}%)`);
        console.log(`[PERF]   Store/Detect: ${(totalStoreTime / 1000).toFixed(2)}s (${((totalStoreTime / totalTime) * 100).toFixed(1)}%)`);
        console.log(`[PERF]   Other:     ${((totalTime - totalMeydaTime - totalFluxTime - totalStoreTime) / 1000).toFixed(2)}s`);
        console.log(`[PERF] Slowest Meyda call: ${slowestMeydaTime.toFixed(3)}ms`);
        this.isAnalyzing = false;
    }

    /**
     * Get audio data at specific time
     * @param {AudioBuffer} buffer - Audio buffer
     * @param {Number} startSample - Starting sample index
     * @param {Number} bufferSize - Size of buffer to extract
     * @returns {Float32Array} - Audio data
     */
    getAudioDataAtTime(buffer, startSample, bufferSize) {
        const data = new Float32Array(bufferSize);

        // If we're at the end of the buffer, pad with zeros
        const remainingSamples = Math.min(bufferSize, buffer.length - startSample);

        if (remainingSamples < bufferSize) {
            // Pad with zeros
            data.fill(0);
        }

        // Get audio data from the first channel
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < remainingSamples; i++) {
            data[i] = channelData[startSample + i];
        }

        return data;
    }

    /**
     * Store enhanced extracted features with timestamp
     * @param {Object} features - Extracted features
     * @param {Number} timestamp - Current time in seconds
     */
    storeEnhancedFeatures(features, timestamp) {
        // Store feature history for trend analysis
        this.featureHistory.energy.push({ value: features.energy, time: timestamp });
        this.featureHistory.spectralFlux.push({ value: features.spectralFlux, time: timestamp });
        this.featureHistory.loudness.push({
            value: features.loudness.total,
            specific: features.loudness.specific,
            time: timestamp
        });
        this.featureHistory.spectralFlatness.push({ value: features.spectralFlatness, time: timestamp });
        this.featureHistory.rms.push({ value: features.rms, time: timestamp });

        // Store band energies
        this.featureHistory.lowBandEnergy.push({ value: features.lowBandEnergy, time: timestamp });
        this.featureHistory.midBandEnergy.push({ value: features.midBandEnergy, time: timestamp });
        this.featureHistory.highBandEnergy.push({ value: features.highBandEnergy, time: timestamp });

        // Keep history at a reasonable size
        const maxHistory = this.settings.analysisWindowSize * 10;
        this.trimHistory(maxHistory);

        // Detect events in real-time
        this.detectEnhancedEvents(features, timestamp);
    }

    /**
     * Trim feature history to prevent memory issues
     * @param {Number} maxItems - Maximum items to keep
     */
    trimHistory(maxItems) {
        Object.keys(this.featureHistory).forEach(feature => {
            const history = this.featureHistory[feature];
            if (history.length > maxItems) {
                this.featureHistory[feature] = history.slice(history.length - maxItems);
            }
        });
    }

    /**
     * Detect enhanced musical events in real-time during analysis
     * @param {Object} features - Current features
     * @param {Number} timestamp - Current time in seconds
     */
    detectEnhancedEvents(features, timestamp) {
        const windowSize = this.settings.analysisWindowSize;

        // We need enough history to detect trends
        if (this.featureHistory.energy.length < windowSize) {
            return;
        }

        // Get recent history for comparison
        const recentEnergy = this.featureHistory.energy.slice(-windowSize);
        const recentFlux = this.featureHistory.spectralFlux.slice(-windowSize);
        const recentLoudness = this.featureHistory.loudness.slice(-windowSize);
        const recentRMS = this.featureHistory.rms.slice(-windowSize);
        const recentLowBand = this.featureHistory.lowBandEnergy.slice(-windowSize);
        const recentMidBand = this.featureHistory.midBandEnergy.slice(-windowSize);
        const recentHighBand = this.featureHistory.highBandEnergy.slice(-windowSize);
        const recentFlatness = this.featureHistory.spectralFlatness.slice(-windowSize);

        // Calculate average values
        const avgEnergy = recentEnergy.reduce((sum, item) => sum + item.value, 0) / windowSize;
        const avgFlux = recentFlux.reduce((sum, item) => sum + item.value, 0) / windowSize;
        const avgRMS = recentRMS.reduce((sum, item) => sum + item.value, 0) / windowSize;
        const avgLowBand = recentLowBand.reduce((sum, item) => sum + item.value, 0) / windowSize;
        const avgMidBand = recentMidBand.reduce((sum, item) => sum + item.value, 0) / windowSize;
        const avgHighBand = recentHighBand.reduce((sum, item) => sum + item.value, 0) / windowSize;
        const avgFlatness = recentFlatness.reduce((sum, item) => sum + item.value, 0) / windowSize;

        // Current values
        const currentEnergy = features.energy;
        const currentFlux = features.spectralFlux;
        const currentLoudness = features.loudness.total;
        const currentRMS = features.rms;
        const currentLowBand = features.lowBandEnergy;
        const currentMidBand = features.midBandEnergy;
        const currentHighBand = features.highBandEnergy;
        const currentFlatness = features.spectralFlatness;

        // Calculate rate of change for each feature
        const energyChange = currentEnergy / (avgEnergy || 0.01);
        const fluxChange = currentFlux / (avgFlux || 0.01);
        const rmsChange = currentRMS / (avgRMS || 0.01);
        const lowBandChange = currentLowBand / (avgLowBand || 0.01);
        const midBandChange = currentMidBand / (avgMidBand || 0.01);
        const highBandChange = currentHighBand / (avgHighBand || 0.01);
        const flatnessChange = Math.abs(currentFlatness - avgFlatness) / (avgFlatness || 0.01);

        // 1. DETECT TRANSIENTS (ONSET DETECTION):
        // --------------------------------------

        // Calculate how much each band exceeds its threshold by (normalization factor)
        const lowExceedsFactor = lowBandChange / this.settings.lowFreqOnsetThreshold;
        const midExceedsFactor = midBandChange / this.settings.midFreqOnsetThreshold;
        const highExceedsFactor = highBandChange / this.settings.highFreqOnsetThreshold;

        // Check if any band exceeds its threshold
        const lowBandExceedsThreshold = lowExceedsFactor > 1;
        const midBandExceedsThreshold = midExceedsFactor > 1;
        const highBandExceedsThreshold = highExceedsFactor > 1;

        // More detailed debug info
        if (lowBandExceedsThreshold || midBandExceedsThreshold || highBandExceedsThreshold) {
            console.log(`Time ${timestamp.toFixed(2)} - Band changes:`, {
                low: `${lowBandChange.toFixed(2)} / ${this.settings.lowFreqOnsetThreshold} = ${lowExceedsFactor.toFixed(2)}`,
                mid: `${midBandChange.toFixed(2)} / ${this.settings.midFreqOnsetThreshold} = ${midExceedsFactor.toFixed(2)}`,
                high: `${highBandChange.toFixed(2)} / ${this.settings.highFreqOnsetThreshold} = ${highExceedsFactor.toFixed(2)}`
            });
        }

        // Check if we can add a transient at this time
        if (this.canAddTransient(timestamp)) {
            // NEW APPROACH: Add a separate transient for EACH band that exceeds its threshold
            // instead of picking a dominant one

            // Add small time offsets for each band to prevent exact timestamp duplicates
            // This ensures they all show up in visualization
            let bandsDetected = 0;

            // Check low band
            if (lowBandExceedsThreshold) {
                // Add a tiny offset (1ms) to avoid exact timestamp collision
                const offsetTime = timestamp + (bandsDetected * 0.001);

                this.results.transients.push({
                    time: offsetTime,
                    value: lowBandChange,
                    intensity: lowExceedsFactor,
                    dominantBand: 'low',
                    dominantValue: lowBandChange,
                    rmsChange: rmsChange
                });

                console.log('Low band transient detected at', offsetTime.toFixed(3),
                    'with value', lowBandChange.toFixed(2), 'vs threshold',
                    this.settings.lowFreqOnsetThreshold.toFixed(2),
                    '(exceeded by factor of', lowExceedsFactor.toFixed(2), ')');

                bandsDetected++;
            }

            // Check mid band
            if (midBandExceedsThreshold) {
                const offsetTime = timestamp + (bandsDetected * 0.001);

                this.results.transients.push({
                    time: offsetTime,
                    value: midBandChange,
                    intensity: midExceedsFactor,
                    dominantBand: 'mid',
                    dominantValue: midBandChange,
                    rmsChange: rmsChange
                });

                console.log('Mid band transient detected at', offsetTime.toFixed(3),
                    'with value', midBandChange.toFixed(2), 'vs threshold',
                    this.settings.midFreqOnsetThreshold.toFixed(2),
                    '(exceeded by factor of', midExceedsFactor.toFixed(2), ')');

                bandsDetected++;
            }

            // Check high band
            if (highBandExceedsThreshold) {
                const offsetTime = timestamp + (bandsDetected * 0.001);

                this.results.transients.push({
                    time: offsetTime,
                    value: highBandChange,
                    intensity: highExceedsFactor,
                    dominantBand: 'high',
                    dominantValue: highBandChange,
                    rmsChange: rmsChange
                });

                console.log('High band transient detected at', offsetTime.toFixed(3),
                    'with value', highBandChange.toFixed(2), 'vs threshold',
                    this.settings.highFreqOnsetThreshold.toFixed(2),
                    '(exceeded by factor of', highExceedsFactor.toFixed(2), ')');

                bandsDetected++;
            }

            if (bandsDetected > 0) {
                console.log(`Detected transients in ${bandsDetected} frequency bands at time ${timestamp.toFixed(3)}`);
            }
        }

        // 2. DETECT ENERGY VARIATIONS:
        // -------------------------

        // Detect overall dynamic changes at different thresholds
        if (rmsChange > this.settings.dramaticChangeThreshold &&
            this.canAddEvent('dynamicChanges', timestamp)) {
            this.results.dynamicChanges.push({
                time: timestamp,
                value: rmsChange,
                intensity: rmsChange,
                category: 'dramatic'
            });
        } else if (rmsChange > this.settings.significantChangeThreshold &&
            this.canAddEvent('dynamicChanges', timestamp)) {
            this.results.dynamicChanges.push({
                time: timestamp,
                value: rmsChange,
                intensity: rmsChange,
                category: 'significant'
            });
        } else if (rmsChange > this.settings.moderateChangeThreshold &&
            this.canAddEvent('dynamicChanges', timestamp)) {
            this.results.dynamicChanges.push({
                time: timestamp,
                value: rmsChange,
                intensity: rmsChange,
                category: 'moderate'
            });
        }

        // 3. DETECT FREQUENCY BAND ACTIVITIES:
        // ----------------------------------

        // Keep the existing low frequency event detection
        if (currentLowBand > this.settings.lowFrequencyThreshold &&
            this.canAddEvent('lowFrequencyEvents', timestamp)) {
            this.results.lowFrequencyEvents.push({
                time: timestamp,
                value: currentLowBand,
                change: lowBandChange
            });
        }

        // Detect mid-range frequency events
        if (midBandChange > this.settings.moderateChangeThreshold &&
            this.canAddEvent('midRangeEvents', timestamp)) {
            this.results.midRangeEvents.push({
                time: timestamp,
                value: currentMidBand,
                change: midBandChange
            });
        }

        // Detect high-frequency events
        if (highBandChange > this.settings.moderateChangeThreshold &&
            this.canAddEvent('highFrequencyEvents', timestamp)) {
            this.results.highFrequencyEvents.push({
                time: timestamp,
                value: currentHighBand,
                change: highBandChange
            });
        }

        // 4. DETECT TIMBRAL CHANGES:
        // -------------------------

        // Combine flatness change with spectral centroid shifts
        if (flatnessChange > this.settings.timbreChangeThreshold &&
            this.canAddEvent('timbreChanges', timestamp)) {
            this.results.timbreChanges.push({
                time: timestamp,
                flatness: currentFlatness,
                spread: 0,   // Removed for performance
                centroid: 0, // Removed for performance
                intensity: flatnessChange
            });
        }

        // Also keep the existing event detections for compatibility:

        // Energy peaks
        if (energyChange > this.settings.energyThreshold &&
            this.canAddEvent('energyPeaks', timestamp)) {
            this.results.energyPeaks.push({
                time: timestamp,
                value: currentEnergy,
                change: energyChange
            });
        }

        // Spectral flux spikes (beats and transients)
        if (fluxChange > this.settings.spectralFluxThreshold &&
            this.canAddEvent('beats', timestamp)) {
            this.results.beats.push({
                time: timestamp,
                value: currentFlux,
                change: fluxChange
            });
        }

        // Store spectrum events
        const prevFlatness = this.featureHistory.spectralFlatness.length > 0 ?
            this.featureHistory.spectralFlatness[this.featureHistory.spectralFlatness.length - 1].value : 0;

        if (Math.abs(features.spectralFlatness - prevFlatness) > 0.2 &&
            this.canAddEvent('spectrumEvents', timestamp)) {
            this.results.spectrumEvents.push({
                time: timestamp,
                flatness: features.spectralFlatness,
                spread: 0 // Removed for performance
            });
        }
    }

    /**
     * Check if we can add a transient event (avoid duplicates close in time)
     * @param {Number} timestamp - Current timestamp
     * @returns {Boolean} - True if transient can be added
     */
    canAddTransient(timestamp) {
        const minTime = this.settings.onsetMinInterval;  // Use shorter interval for transients
        const lastEvent = this.results.transients[this.results.transients.length - 1];

        if (!lastEvent) return true;
        return (timestamp - lastEvent.time) > minTime;
    }

    /**
     * Check if we can add an event (avoid duplicates close in time)
     * @param {String} eventType - Type of event
     * @param {Number} timestamp - Current timestamp
     * @returns {Boolean} - True if event can be added
     */
    canAddEvent(eventType, timestamp) {
        const minTime = this.settings.minTimeBetweenEvents;
        const lastEvent = this.results[eventType][this.results[eventType].length - 1];

        if (!lastEvent) return true;
        return (timestamp - lastEvent.time) > minTime;
    }

    /**
     * Process analysis results to find significant events
     */
    processAnalysisResults() {
        console.log('Processing final analysis results...');

        // Sort all events by timestamp
        Object.keys(this.results).forEach(eventType => {
            if (Array.isArray(this.results[eventType])) {
                this.results[eventType].sort((a, b) => a.time - b.time);
            }
        });

        // Detect drops (combination of energy spike and bass increase)
        this.detectDrops();

        // Final beat tracking to create a complete beat grid
        this.finalizeRhythmAnalysis();

        // Clean up results (remove redundant events)
        this.cleanupResults();

        // Log detection results
        console.log('Analysis processing complete');
        console.log('Found:');
        console.log(`- ${this.results.drops.length} drops`);
        console.log(`- ${this.results.beats.length} beats`);
        console.log(`- ${this.results.transients.length} transients (onsets)`);
        console.log(`- ${this.results.beatGrid.length} beat grid positions`);
        console.log(`- ${this.results.dynamicChanges.length} dynamic changes`);
        console.log(`- ${this.results.timbreChanges.length} timbre changes`);
        console.log(`- ${this.results.lowFrequencyEvents.length} bass events`);
        console.log(`- ${this.results.midRangeEvents.length} mid-range events`);
        console.log(`- ${this.results.highFrequencyEvents.length} high-frequency events`);

        // Log tempo if detected
        if (this.beatTracker.tempo > 0) {
            console.log(`Detected tempo: ${this.beatTracker.tempo} BPM (confidence: ${this.beatTracker.confidence.toFixed(2)})`);
        }
    }

    /**
     * Finalize rhythm analysis and complete the beat grid
     */
    finalizeRhythmAnalysis() {
        // If we already have a good beat grid, keep it
        if (this.results.beatGrid.length > 0) {
            console.log('Using existing beat grid with', this.results.beatGrid.length, 'beats');
            return;
        }

        // If we have beat tracker data with confidence, use it
        if (this.beatTracker.confidence > 0.5 && this.beatTracker.tempo > 0) {
            console.log('Creating beat grid from beat tracker data');
            const beatInterval = 60 / this.beatTracker.tempo;

            // Get track duration from feature history
            const duration = this.featureHistory.energy.length > 0
                ? this.featureHistory.energy[this.featureHistory.energy.length - 1].time
                : 60; // Default to 60 seconds if unknown

            // Create beat grid
            let beatTime = 0;
            let beatCount = 0;

            while (beatTime < duration) {
                this.results.beatGrid.push({
                    time: beatTime,
                    beat: beatCount % 4,
                    bar: Math.floor(beatCount / 4),
                    intensity: beatCount % 4 === 0 ? 1.0 : 0.7
                });

                beatTime += beatInterval;
                beatCount++;
            }

            console.log(`Created beat grid with ${this.results.beatGrid.length} beats at ${this.beatTracker.tempo} BPM`);

            // Store tempo information
            this.results.tempo = {
                bpm: this.beatTracker.tempo,
                beatInterval: beatInterval,
                confidence: this.beatTracker.confidence
            };

            return;
        }

        // Fallback to traditional rhythm analysis from detectRhythmMarkers
        // but with enhancements to create a complete beat grid

        // First try using the beats array if we have enough
        if (this.results.beats.length > 4) {
            this.detectRhythmMarkers();

            // If we still don't have a tempo, try with transients
            if (!this.results.tempo && this.results.transients.length > 4) {
                console.log('Using transients for tempo detection');
                const transientTimes = this.results.transients.map(t => t.time);
                this.detectTempoFromTimestamps(transientTimes);
            }
        } else if (this.results.transients.length > 4) {
            // Use transients directly
            const transientTimes = this.results.transients.map(t => t.time);
            this.detectTempoFromTimestamps(transientTimes);
        }

        // If we have a tempo, create a beat grid
        if (this.results.tempo && this.results.tempo.bpm > 0) {
            console.log('Creating beat grid from detected tempo:', this.results.tempo.bpm);

            const duration = this.featureHistory.energy.length > 0
                ? this.featureHistory.energy[this.featureHistory.energy.length - 1].time
                : 60;

            // Create beat grid
            let beatTime = 0;
            let beatCount = 0;

            while (beatTime < duration) {
                this.results.beatGrid.push({
                    time: beatTime,
                    beat: beatCount % 4,
                    bar: Math.floor(beatCount / 4),
                    intensity: beatCount % 4 === 0 ? 1.0 : 0.7
                });

                beatTime += this.results.tempo.beatInterval;
                beatCount++;
            }

            console.log(`Created beat grid with ${this.results.beatGrid.length} beats`);
        } else {
            console.warn('Could not detect reliable tempo for beat grid creation');
        }
    }

    /**
     * Detect tempo from a series of timestamps
     * @param {Array} timestamps - Array of time positions
     */
    detectTempoFromTimestamps(timestamps) {
        if (timestamps.length < 4) return;

        const intervals = [];

        // Calculate intervals between consecutive events
        for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1]);
        }

        // Find the most common interval (tempo)
        const tempoMap = {};
        intervals.forEach(interval => {
            // Round to nearest 10ms for binning
            const roundedInterval = Math.round(interval * 100) / 100;
            tempoMap[roundedInterval] = (tempoMap[roundedInterval] || 0) + 1;
        });

        // Find the most common tempo
        let dominantTempo = 0;
        let maxCount = 0;

        Object.entries(tempoMap).forEach(([tempo, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominantTempo = parseFloat(tempo);
            }
        });

        // Calculate the BPM
        const bpm = dominantTempo > 0 ? Math.round(60 / dominantTempo) : 0;

        // Check if the BPM is reasonable
        if (bpm >= 60 && bpm <= 200) {
            // Store tempo information
            this.results.tempo = {
                bpm: bpm,
                beatInterval: dominantTempo,
                confidence: maxCount / intervals.length
            };

            console.log(`Detected tempo: ${bpm} BPM (confidence: ${(maxCount / intervals.length).toFixed(2)})`);
        } else {
            console.warn(`Unreliable tempo detected: ${bpm} BPM - ignoring`);
        }
    }

    /**
     * Detect drops (significant changes in energy, especially in low frequencies)
     */
    detectDrops() {
        const dropCandidates = [];

        // Find high energy moments that also have bass presence
        for (const energyPeak of this.results.energyPeaks) {
            // Find nearby bass events
            const nearbyBass = this.results.lowFrequencyEvents.find(bassEvent =>
                Math.abs(bassEvent.time - energyPeak.time) < 0.1
            );

            if (nearbyBass) {
                // This is likely a drop
                dropCandidates.push({
                    time: energyPeak.time,
                    energy: energyPeak.value,
                    bassEnergy: nearbyBass.value,
                    confidence: energyPeak.change * (nearbyBass.value / 2)
                });
            }
        }

        // Sort by confidence and keep only significant drops
        dropCandidates.sort((a, b) => b.confidence - a.confidence);

        // Only keep drops that are at least 2 seconds apart
        const significantDrops = [];
        for (const drop of dropCandidates) {
            if (!significantDrops.some(existingDrop =>
                Math.abs(existingDrop.time - drop.time) < 2
            )) {
                significantDrops.push(drop);
            }
        }

        this.results.drops = significantDrops;
    }

    /**
     * Detect rhythm markers (repeated beat patterns)
     */
    detectRhythmMarkers() {
        // Simple rhythm detection based on consistent beat intervals
        if (this.results.beats.length < 4) return;

        const beatTimes = this.results.beats.map(beat => beat.time);
        const intervals = [];

        // Calculate intervals between consecutive beats
        for (let i = 1; i < beatTimes.length; i++) {
            intervals.push(beatTimes[i] - beatTimes[i - 1]);
        }

        // Find the most common interval (tempo)
        const tempoMap = {};
        intervals.forEach(interval => {
            // Round to nearest 10ms for binning
            const roundedInterval = Math.round(interval * 100) / 100;
            tempoMap[roundedInterval] = (tempoMap[roundedInterval] || 0) + 1;
        });

        // Find the most common tempo
        let dominantTempo = 0;
        let maxCount = 0;

        Object.entries(tempoMap).forEach(([tempo, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominantTempo = parseFloat(tempo);
            }
        });

        // Calculate the BPM
        const bpm = dominantTempo > 0 ? Math.round(60 / dominantTempo) : 0;

        // Store rhythm information
        if (bpm > 0) {
            this.results.tempo = {
                bpm: bpm,
                beatInterval: dominantTempo
            };

            // Mark downbeats (every 4 beats assuming 4/4 time)
            let currentBeat = 0;
            while (currentBeat < beatTimes[beatTimes.length - 1]) {
                this.results.rhythmMarkers.push({
                    time: currentBeat,
                    type: 'beat',
                    beatNumber: this.results.rhythmMarkers.length % 4
                });
                currentBeat += dominantTempo;
            }
        }
    }

    /**
     * Clean up redundant results
     */
    cleanupResults() {
        // Filter out duplicate events that are very close in time
        Object.keys(this.results).forEach(eventType => {
            if (Array.isArray(this.results[eventType])) {
                // Skip if there are no items
                if (this.results[eventType].length === 0) return;

                const filtered = [this.results[eventType][0]];

                for (let i = 1; i < this.results[eventType].length; i++) {
                    const current = this.results[eventType][i];
                    const last = filtered[filtered.length - 1];

                    // If events are separated enough, keep both
                    if (current.time - last.time > this.settings.minTimeBetweenEvents) {
                        filtered.push(current);
                    }
                    // Otherwise, keep the stronger one
                    else if (current.value > last.value) {
                        filtered[filtered.length - 1] = current;
                    }
                }

                this.results[eventType] = filtered;
            }
        });
    }

    /**
     * Reset analysis results
     */
    resetResults() {
        this.results = {
            drops: [],
            beats: [],
            energyPeaks: [],
            spectrumEvents: [],
            rhythmMarkers: [],
            lowFrequencyEvents: [],
            // Reset new event types
            transients: [],
            beatGrid: [],
            midRangeEvents: [],
            highFrequencyEvents: [],
            timbreChanges: [],
            dynamicChanges: []
        };

        Object.keys(this.featureHistory).forEach(key => {
            this.featureHistory[key] = [];
        });

        // Reset beat tracker
        this.beatTracker = {
            lastBeatTime: 0,
            beatIntervals: [],
            confidence: 0,
            tempo: 0
        };
    }

    /**
     * Stop ongoing analysis
     */
    stop() {
        this.isAnalyzing = false;
        if (this.audioSource) {
            this.audioSource.disconnect();
        }
    }

    /**
     * Get formatted results for animation use
     * @returns {Object} Formatted results with timestamps
     */
    getFormattedResults() {
        // Create a timeline of all significant events
        const timeline = [];

        // Add drops (most important)
        this.results.drops.forEach(drop => {
            timeline.push({
                time: drop.time,
                type: 'drop',
                intensity: drop.confidence,
                suggestedAnimation: {
                    speed: 1.5 + (drop.confidence / 2), // Increase speed based on intensity
                    bounceFactor: 0.4,
                    addRotation: true,
                    rotationAmount: Math.PI * 2,
                    height: 8
                }
            });
        });

        // Add transients (onsets)
        this.results.transients.forEach(transient => {
            // Different animation suggestions based on frequency band
            let animParams = {
                speed: 1.2 + (transient.intensity / 4),
                bounceFactor: 0.3,
                sequential: transient.dominantBand !== 'low', // Sequential for mid/high
                height: 3 + (transient.intensity),
            };

            // Customize based on dominant frequency band
            switch (transient.dominantBand) {
                case 'low':
                    animParams.bounceFactor = 0.5 + (transient.intensity / 4);
                    animParams.height = 4 + (transient.intensity * 2);
                    break;
                case 'mid':
                    animParams.addTilt = true;
                    animParams.sequenceDelay = 0.03;
                    break;
                case 'high':
                    animParams.speed = 1.5;
                    animParams.bounceFactor = 0.15;
                    animParams.sequenceDelay = 0.02;
                    animParams.height = 2;
                    break;
            }

            // Create a new transient object with all original properties plus animation suggestions
            const transientEvent = {
                ...transient, // Include ALL original properties
                type: 'transient',
                subtype: transient.dominantBand,
                suggestedAnimation: animParams
            };

            timeline.push(transientEvent);
        });

        // Add beat grid events
        this.results.beatGrid.forEach(beat => {
            // Different animation for downbeats (first beat of bar) vs regular beats
            const isDownbeat = beat.beat === 0;

            timeline.push({
                time: beat.time,
                type: 'grid_beat',
                subtype: isDownbeat ? 'downbeat' : 'beat',
                intensity: beat.intensity,
                beat: beat.beat,
                bar: beat.bar,
                suggestedAnimation: {
                    speed: isDownbeat ? 1.3 : 1.1,
                    bounceFactor: isDownbeat ? 0.3 : 0.2,
                    height: isDownbeat ? 4 : 2.5,
                    sequential: !isDownbeat,
                    sequenceDelay: 0.05,
                    addRotation: isDownbeat,
                    rotationAmount: isDownbeat ? Math.PI / 4 : 0
                }
            });
        });

        // Add dynamic changes
        this.results.dynamicChanges.forEach(change => {
            let animParams = {};

            // Different settings based on intensity category
            switch (change.category) {
                case 'dramatic':
                    animParams = {
                        speed: 1.8 + (change.intensity / 3),
                        bounceFactor: 0.45,
                        addRotation: true,
                        rotationAmount: Math.PI,
                        height: 7
                    };
                    break;

                case 'significant':
                    animParams = {
                        speed: 1.5 + (change.intensity / 4),
                        bounceFactor: 0.35,
                        addTilt: true,
                        height: 5
                    };
                    break;

                case 'moderate':
                default:
                    animParams = {
                        speed: 1.2 + (change.intensity / 5),
                        bounceFactor: 0.25,
                        sequential: true,
                        sequenceDelay: 0.05,
                        height: 4
                    };
                    break;
            }

            timeline.push({
                time: change.time,
                type: 'dynamic_' + change.category,
                intensity: change.intensity,
                suggestedAnimation: animParams
            });
        });

        // Add timbre changes
        this.results.timbreChanges.forEach(timbre => {
            timeline.push({
                time: timbre.time,
                type: 'timbre',
                intensity: timbre.intensity,
                suggestedAnimation: {
                    addRotation: true,
                    rotationAmount: Math.PI / 2 * timbre.intensity,
                    cinematicRotation: true,
                    cinematicRotationSpeed: 0.3 * timbre.intensity,
                    randomizeOrder: true
                }
            });
        });

        // Add mid-range events
        this.results.midRangeEvents.forEach(event => {
            timeline.push({
                time: event.time,
                type: 'mid_range',
                intensity: event.change,
                suggestedAnimation: {
                    speed: 1.1 + (event.change / 4),
                    bounceFactor: 0.2,
                    sequential: true,
                    addTilt: true
                }
            });
        });

        // Add high-frequency events
        this.results.highFrequencyEvents.forEach(event => {
            timeline.push({
                time: event.time,
                type: 'high_freq',
                intensity: event.change,
                suggestedAnimation: {
                    speed: 1.3 + (event.change / 3),
                    bounceFactor: 0.1,
                    sequential: true,
                    sequenceDelay: 0.02,
                    reverseDropOrder: Math.random() > 0.5 // Random reverse direction
                }
            });
        });

        // Also include original event types
        this.results.beats.forEach(beat => {
            timeline.push({
                time: beat.time,
                type: 'beat',
                intensity: beat.change,
                suggestedAnimation: {
                    speed: 1.0 + (beat.change / 4),
                    bounceFactor: 0.2,
                    sequential: true,
                    sequenceDelay: 0.05
                }
            });
        });

        this.results.lowFrequencyEvents.forEach(event => {
            timeline.push({
                time: event.time,
                type: 'bass',
                intensity: event.value,
                suggestedAnimation: {
                    bounceFactor: 0.3 + (event.value / 3),
                    height: 5 + (event.value * 2)
                }
            });
        });

        // Sort by timestamp
        timeline.sort((a, b) => a.time - b.time);

        return {
            timeline,
            tempo: this.results.tempo,
            duration: this.featureHistory.energy.length > 0
                ? this.featureHistory.energy[this.featureHistory.energy.length - 1].time
                : 0,
            // Include raw audio samples for waveform display
            audioData: this.audioData,
            // Include feature history for adaptive normalization
            featureHistory: this.featureHistory
        };
    }

    /**
     * Extract waveform data from audio buffer for visualization
     * @param {AudioBuffer} audioBuffer - The audio buffer
     */
    extractWaveformData(audioBuffer) {
        // Downsample the audio data to a reasonable size for visualization
        const channel = audioBuffer.getChannelData(0);
        const length = channel.length;

        // Aim for about 2000-3000 points for visualization
        const sampleSize = Math.max(1, Math.floor(length / 2000));

        const samples = [];
        let maxSample = 0;

        // Get peaks for drawing the waveform
        for (let i = 0; i < length; i += sampleSize) {
            let max = 0;
            for (let j = 0; j < sampleSize && i + j < length; j++) {
                const abs = Math.abs(channel[i + j]);
                if (abs > max) max = abs;
                if (abs > maxSample) maxSample = abs;
            }
            samples.push({
                time: i / audioBuffer.sampleRate,
                value: max
            });
        }

        // Normalize the values
        if (maxSample > 0) {
            samples.forEach(sample => {
                sample.value = sample.value / maxSample;
            });
        }

        this.audioData = {
            samples,
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate
        };
    }

    /**
     * If Meyda analysis fails, fall back to simple analysis
     */
    async analyzeWithFallback(audioFile) {
        if (!this.audioContext) {
            this.init();
        }

        try {
            // Reset results
            this.resetResults();

            // Load audio file
            const audioBuffer = await this.loadAudioFile(audioFile);
            console.log(`Loaded audio file: ${audioBuffer.duration.toFixed(2)} seconds`);

            try {
                // Try the regular analysis first
                await this.runOfflineAnalysis(audioBuffer);
            } catch (error) {
                console.warn('Regular analysis failed, falling back to simple analysis:', error);
                // Fall back to simple analysis
                await this.runSimpleAnalysis(audioBuffer);
            }

            // Process the collected data
            this.processAnalysisResults();

            return this.results;
        } catch (error) {
            console.error('Error analyzing audio file:', error);
            throw error;
        }
    }

    /**
     * Reanalyze with new threshold settings using cached data
     * @param {Object} newSettings - New threshold settings
     * @returns {Promise} - Resolves with updated analysis results
     */
    async reanalyzeWithNewThresholds(newSettings) {
        console.log('Reanalyzing with new thresholds:', newSettings);

        if (!this.cachedData.audioBuffer) {
            throw new Error('No cached audio data available for reanalysis');
        }

        // Update settings with new thresholds
        if (newSettings) {
            Object.keys(newSettings).forEach(key => {
                if (this.settings.hasOwnProperty(key)) {
                    this.settings[key] = newSettings[key];
                }
            });
        }

        // Reset certain results but keep cached data
        this.results.transients = [];

        if (this.cachedData.rawTransients && this.cachedData.rawTransients.length > 0) {
            // Fast path: Just re-filter the already detected transients with new thresholds
            this.refilterTransients();
        } else {
            // Slow path: Rerun the full analysis
            await this.runOfflineAnalysis(this.cachedData.audioBuffer);
        }

        // Process the results again
        this.processAnalysisResults();

        return this.results;
    }

    /**
     * Re-filter transients with the updated thresholds
     * Much faster than full re-analysis
     */
    refilterTransients() {
        console.log('Re-filtering transients with new thresholds');

        // Start with all raw detected transients
        const allPotentialTransients = this.cachedData.rawTransients;

        // Apply the new thresholds
        allPotentialTransients.forEach(transient => {
            // Check if this transient passes the current threshold
            let exceedsFactor = 0;
            let threshold = 1.0;

            switch (transient.dominantBand) {
                case 'low':
                    threshold = this.settings.lowFreqOnsetThreshold;
                    exceedsFactor = transient.value / threshold;
                    break;
                case 'mid':
                    threshold = this.settings.midFreqOnsetThreshold;
                    exceedsFactor = transient.value / threshold;
                    break;
                case 'high':
                    threshold = this.settings.highFreqOnsetThreshold;
                    exceedsFactor = transient.value / threshold;
                    break;
                default:
                    threshold = this.settings.onsetThreshold;
                    exceedsFactor = transient.value / threshold;
            }

            // If transient exceeds the new threshold, add it to results
            if (exceedsFactor > 1.0) {
                // Update the intensity to reflect the new threshold
                const updated = { ...transient, intensity: exceedsFactor };
                this.results.transients.push(updated);
            }
        });

        console.log(`After re-filtering, kept ${this.results.transients.length} out of ${allPotentialTransients.length} transients`);
    }
}

// Create a shared analyzer instance for reuse
let sharedAnalyzer = null;

/**
 * Create a simple analyzer for quick use
 * @param {String|File} audioFile - Audio file to analyze
 * @param {Object} options - Optional analysis settings
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeAudioFile(audioFile, options = {}) {
    // Create analyzer or reuse existing one
    if (!sharedAnalyzer) {
        sharedAnalyzer = new AudioAnalyzer();
    }

    // Check if this is a reanalysis with new thresholds
    const isReanalysis = !audioFile && options && Object.keys(options).length > 0;

    // Apply any custom threshold settings
    if (options) {
        Object.keys(options).forEach(key => {
            if (sharedAnalyzer.settings.hasOwnProperty(key)) {
                sharedAnalyzer.settings[key] = options[key];
            }
        });
    }

    try {
        if (isReanalysis) {
            // Just update thresholds and refilter without loading file again
            await sharedAnalyzer.reanalyzeWithNewThresholds(options);
        } else {
            // Analyze a new file
            await sharedAnalyzer.analyzeFile(audioFile);
        }
    } catch (error) {
        console.warn("Standard analysis failed, trying fallback method:", error);
        // If that fails, try the fallback approach
        if (!isReanalysis) {
            await sharedAnalyzer.analyzeWithFallback(audioFile);
        }
    }
    return sharedAnalyzer.getFormattedResults();
} 