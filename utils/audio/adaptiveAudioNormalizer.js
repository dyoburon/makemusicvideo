/**
 * Adaptive Audio Normalizer
 *
 * Provides percentile-based and rolling window normalization for audio features.
 * This replaces static thresholds with adaptive normalization that works across
 * all music genres without manual tuning.
 *
 * Usage:
 *   1. After audio analysis, call buildDistributions() with the feature history
 *   2. During playback, call getNormalizedValues() with current feature values
 *   3. Use the returned values (0-1 range) instead of threshold-based detection
 */

class AdaptiveAudioNormalizer {
    constructor() {
        // Percentile distributions for each band (computed once per song)
        this.distributions = {
            low: null,
            mid: null,
            high: null,
            energy: null,
            rms: null
        };

        // Rolling window state for local context
        this.rollingWindow = {
            low: [],
            mid: [],
            high: [],
            energy: [],
            rms: []
        };

        // Configuration
        this.config = {
            // Rolling window size in samples (at ~86 samples/sec = ~5 seconds)
            rollingWindowSize: 430,

            // How much local deviation affects the output (0-1)
            // Higher = more responsive to local standouts
            localSensitivity: 0.5,

            // Minimum percentile to consider as "active" (0-1)
            // Values below this percentile will map to 0
            activeFloor: 0.3,

            // Percentile bins for faster lookup
            percentileBins: 100
        };

        // Statistics for each band
        this.stats = {
            low: { min: 0, max: 0, mean: 0, stdDev: 0 },
            mid: { min: 0, max: 0, mean: 0, stdDev: 0 },
            high: { min: 0, max: 0, mean: 0, stdDev: 0 },
            energy: { min: 0, max: 0, mean: 0, stdDev: 0 },
            rms: { min: 0, max: 0, mean: 0, stdDev: 0 }
        };

        this.isInitialized = false;

        // Store feature history for time-based lookup during playback
        this.featureHistory = null;
    }

    /**
     * Build percentile distributions from feature history
     * Call this after audio analysis completes
     *
     * @param {Object} featureHistory - Feature history from AudioAnalyzer
     *   Expected structure: { lowBandEnergy: [{value, time}], midBandEnergy: [...], ... }
     */
    buildDistributions(featureHistory) {
        console.log('[AdaptiveNorm] Building distributions from feature history');

        if (!featureHistory) {
            console.error('[AdaptiveNorm] No feature history provided');
            return false;
        }

        // Store feature history for time-based lookup
        this.featureHistory = featureHistory;

        // Map feature history keys to our internal names
        const keyMap = {
            low: 'lowBandEnergy',
            mid: 'midBandEnergy',
            high: 'highBandEnergy',
            energy: 'energy',
            rms: 'rms'
        };

        // Build distribution for each band
        for (const [band, historyKey] of Object.entries(keyMap)) {
            const history = featureHistory[historyKey];

            if (!history || history.length === 0) {
                console.warn(`[AdaptiveNorm] No history for ${band} (${historyKey})`);
                continue;
            }

            // Extract values
            const values = history.map(h => h.value).filter(v => v !== undefined && !isNaN(v));

            if (values.length === 0) {
                console.warn(`[AdaptiveNorm] No valid values for ${band}`);
                continue;
            }

            // Sort for percentile calculation
            const sorted = [...values].sort((a, b) => a - b);

            // Calculate statistics
            const sum = values.reduce((acc, v) => acc + v, 0);
            const mean = sum / values.length;
            const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);

            this.stats[band] = {
                min: sorted[0],
                max: sorted[sorted.length - 1],
                mean,
                stdDev,
                count: values.length
            };

            // Build percentile lookup table
            const bins = this.config.percentileBins;
            this.distributions[band] = new Float32Array(bins);

            for (let i = 0; i < bins; i++) {
                const percentile = i / (bins - 1);
                const index = Math.floor(percentile * (sorted.length - 1));
                this.distributions[band][i] = sorted[index];
            }

            console.log(`[AdaptiveNorm] ${band}: min=${sorted[0].toFixed(4)}, max=${sorted[sorted.length - 1].toFixed(4)}, mean=${mean.toFixed(4)}, stdDev=${stdDev.toFixed(4)}`);
        }

        this.isInitialized = true;
        console.log('[AdaptiveNorm] Distributions built successfully');
        return true;
    }

    /**
     * Get the percentile rank of a value for a given band
     *
     * @param {string} band - Band name (low, mid, high, energy, rms)
     * @param {number} value - Current value
     * @returns {number} Percentile rank (0-1)
     */
    getPercentile(band, value) {
        const dist = this.distributions[band];
        if (!dist) return 0.5;

        // Binary search for the percentile
        let low = 0;
        let high = dist.length - 1;

        // Handle edge cases
        if (value <= dist[0]) return 0;
        if (value >= dist[high]) return 1;

        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (dist[mid] < value) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        // Interpolate for more precision
        if (low > 0 && dist[low] !== dist[low - 1]) {
            const ratio = (value - dist[low - 1]) / (dist[low] - dist[low - 1]);
            return (low - 1 + ratio) / (dist.length - 1);
        }

        return low / (dist.length - 1);
    }

    /**
     * Get rolling window statistics for local context
     *
     * @param {string} band - Band name
     * @param {number} value - Current value to add
     * @returns {Object} { mean, stdDev, zScore }
     */
    updateRollingWindow(band, value) {
        const window = this.rollingWindow[band];

        // Add new value
        window.push(value);

        // Trim to max size
        while (window.length > this.config.rollingWindowSize) {
            window.shift();
        }

        // Calculate rolling statistics
        if (window.length < 10) {
            // Not enough data yet
            return { mean: value, stdDev: 0.001, zScore: 0 };
        }

        const sum = window.reduce((acc, v) => acc + v, 0);
        const mean = sum / window.length;
        const variance = window.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / window.length;
        const stdDev = Math.sqrt(variance) || 0.001; // Avoid division by zero

        const zScore = (value - mean) / stdDev;

        return { mean, stdDev, zScore };
    }

    /**
     * Get normalized values for the current audio features
     * This is the main method to call during playback
     *
     * @param {Object} currentFeatures - Current feature values
     *   Expected: { lowBandEnergy, midBandEnergy, highBandEnergy, energy, rms }
     * @returns {Object} Normalized values (0-1 range)
     *   { low, mid, high, energy, transients }
     */
    getNormalizedValues(currentFeatures) {
        if (!this.isInitialized) {
            // Return defaults if not initialized
            return {
                low: 0.5,
                mid: 0.5,
                high: 0.5,
                energy: 0.5,
                transients: 0
            };
        }

        const result = {};
        const sensitivity = this.config.localSensitivity;
        const floor = this.config.activeFloor;

        // Process each band
        const bands = [
            { name: 'low', key: 'lowBandEnergy' },
            { name: 'mid', key: 'midBandEnergy' },
            { name: 'high', key: 'highBandEnergy' },
            { name: 'energy', key: 'energy' }
        ];

        for (const { name, key } of bands) {
            const value = currentFeatures[key];

            if (value === undefined || isNaN(value)) {
                result[name] = 0.5;
                continue;
            }

            // Get global percentile (where does this value rank in the song?)
            const percentile = this.getPercentile(name, value);

            // Get local context (is this value unusual compared to recent history?)
            const rolling = this.updateRollingWindow(name, value);

            // Combine global percentile with local deviation
            // - percentile gives us "where are we in the song's range"
            // - zScore gives us "is this a standout moment locally"

            // Convert zScore to a 0-1 boost (sigmoid-like)
            // zScore of 0 = no boost, zScore of 2+ = near max boost
            const localBoost = Math.tanh(rolling.zScore * 0.5) * 0.5 + 0.5;

            // Blend global and local
            let normalized = percentile * (1 - sensitivity) + localBoost * sensitivity;

            // Apply floor (values below this percentile become 0)
            if (percentile < floor) {
                normalized *= percentile / floor; // Gradual fade to 0
            }

            // Clamp to 0-1
            result[name] = Math.max(0, Math.min(1, normalized));
        }

        // Calculate transients from rate of change
        // A transient is when the current value significantly exceeds recent average
        const lowRolling = this.rollingWindow.low;
        const midRolling = this.rollingWindow.mid;
        const highRolling = this.rollingWindow.high;

        let transientStrength = 0;

        if (lowRolling.length >= 10) {
            // Check each band for transients
            const bands = ['low', 'mid', 'high'];
            for (const band of bands) {
                const window = this.rollingWindow[band];
                if (window.length < 10) continue;

                // Get recent average (last ~100ms worth, about 8-9 samples)
                const recentCount = Math.min(9, window.length);
                const recentSum = window.slice(-recentCount).reduce((a, b) => a + b, 0);
                const recentAvg = recentSum / recentCount;

                // Current value vs recent average
                const current = window[window.length - 1];
                if (recentAvg > 0.0001) {
                    const ratio = current / recentAvg;
                    // If current value is significantly higher than recent average, it's a transient
                    if (ratio > 1.5) {
                        const bandTransient = Math.min(1, (ratio - 1.5) / 1.5);
                        transientStrength = Math.max(transientStrength, bandTransient);
                    }
                }
            }
        }

        result.transients = transientStrength;

        return result;
    }

    /**
     * Get values formatted for direct use in processAudioDataForShader
     * Returns values in FULL 0-1 range for maximum dynamic impact
     *
     * @param {Object} currentFeatures - Current feature values
     * @returns {Object} { energy, lowEnergy, midEnergy, highEnergy, transients }
     */
    getShaderValues(currentFeatures) {
        const normalized = this.getNormalizedValues(currentFeatures);

        // Use FULL 0-1 range for maximum dynamic impact (not 0.5-1.0)
        return {
            energy: normalized.energy,
            lowEnergy: normalized.low,
            midEnergy: normalized.mid,
            highEnergy: normalized.high,
            transients: normalized.transients
        };
    }

    /**
     * Reset the normalizer state
     */
    reset() {
        this.distributions = {
            low: null,
            mid: null,
            high: null,
            energy: null,
            rms: null
        };

        this.rollingWindow = {
            low: [],
            mid: [],
            high: [],
            energy: [],
            rms: []
        };

        this.stats = {
            low: { min: 0, max: 0, mean: 0, stdDev: 0 },
            mid: { min: 0, max: 0, mean: 0, stdDev: 0 },
            high: { min: 0, max: 0, mean: 0, stdDev: 0 },
            energy: { min: 0, max: 0, mean: 0, stdDev: 0 },
            rms: { min: 0, max: 0, mean: 0, stdDev: 0 }
        };

        this.isInitialized = false;
    }

    /**
     * Update sensitivity configuration
     *
     * @param {number} sensitivity - How much local deviation affects output (0-1)
     */
    setSensitivity(sensitivity) {
        this.config.localSensitivity = Math.max(0, Math.min(1, sensitivity));
    }

    /**
     * Get current statistics for debugging/visualization
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            stats: this.stats,
            config: this.config,
            rollingWindowSizes: {
                low: this.rollingWindow.low.length,
                mid: this.rollingWindow.mid.length,
                high: this.rollingWindow.high.length,
                energy: this.rollingWindow.energy.length
            }
        };
    }

    /**
     * Look up feature values at a specific time from stored feature history
     * Uses binary search for efficiency
     *
     * @param {number} time - Time in seconds
     * @returns {Object|null} Feature values at that time, or null if not available
     */
    getFeaturesAtTime(time) {
        if (!this.featureHistory) {
            return null;
        }

        const result = {};
        const bands = [
            { name: 'lowBandEnergy', key: 'lowBandEnergy' },
            { name: 'midBandEnergy', key: 'midBandEnergy' },
            { name: 'highBandEnergy', key: 'highBandEnergy' },
            { name: 'energy', key: 'energy' },
            { name: 'rms', key: 'rms' }
        ];

        for (const { name, key } of bands) {
            const history = this.featureHistory[key];
            if (!history || history.length === 0) {
                result[name] = 0;
                continue;
            }

            // Binary search for the closest time
            let low = 0;
            let high = history.length - 1;

            // Handle edge cases
            if (time <= history[0].time) {
                result[name] = history[0].value;
                continue;
            }
            if (time >= history[high].time) {
                result[name] = history[high].value;
                continue;
            }

            // Binary search
            while (low < high - 1) {
                const mid = Math.floor((low + high) / 2);
                if (history[mid].time < time) {
                    low = mid;
                } else {
                    high = mid;
                }
            }

            // Interpolate between the two closest points
            const t1 = history[low].time;
            const t2 = history[high].time;
            const v1 = history[low].value;
            const v2 = history[high].value;

            if (t2 === t1) {
                result[name] = v1;
            } else {
                const ratio = (time - t1) / (t2 - t1);
                result[name] = v1 + (v2 - v1) * ratio;
            }
        }

        return result;
    }

    /**
     * Get shader-ready values at a specific time
     * This is the main method to call during playback when you have the current time
     *
     * @param {number} time - Current playback time in seconds
     * @returns {Object} { energy, lowEnergy, midEnergy, highEnergy, transients }
     */
    getShaderValuesAtTime(time) {
        if (!this.isInitialized) {
            return {
                energy: 0,
                lowEnergy: 0,
                midEnergy: 0,
                highEnergy: 0,
                transients: 0
            };
        }

        // Look up features at current time
        const features = this.getFeaturesAtTime(time);
        if (!features) {
            return {
                energy: 0,
                lowEnergy: 0,
                midEnergy: 0,
                highEnergy: 0,
                transients: 0
            };
        }

        // Use the existing normalization logic
        return this.getShaderValues(features);
    }
}

// Singleton instance for easy access
let sharedNormalizer = null;

/**
 * Get the shared normalizer instance
 * @returns {AdaptiveAudioNormalizer}
 */
export function getAdaptiveNormalizer() {
    if (!sharedNormalizer) {
        sharedNormalizer = new AdaptiveAudioNormalizer();
    }
    return sharedNormalizer;
}

/**
 * Initialize the normalizer with feature history from audio analysis
 * Call this after analyzeAudioFile() completes
 *
 * @param {Object} featureHistory - Feature history from the analyzer
 * @returns {boolean} Success
 */
export function initializeAdaptiveNormalizer(featureHistory) {
    const normalizer = getAdaptiveNormalizer();
    return normalizer.buildDistributions(featureHistory);
}

/**
 * Get normalized audio values for the current frame
 * Call this during playback with current feature values
 *
 * @param {Object} currentFeatures - Current audio features
 * @returns {Object} Normalized values ready for shader use
 */
export function getAdaptiveShaderValues(currentFeatures) {
    const normalizer = getAdaptiveNormalizer();
    return normalizer.getShaderValues(currentFeatures);
}

/**
 * Reset the normalizer (call when loading a new song)
 */
export function resetAdaptiveNormalizer() {
    const normalizer = getAdaptiveNormalizer();
    normalizer.reset();
}

/**
 * Get normalized audio values at a specific playback time
 * This is the main function to call during playback
 *
 * @param {number} time - Current playback time in seconds
 * @returns {Object} { energy, lowEnergy, highEnergy, transients }
 */
export function getAdaptiveValuesAtTime(time) {
    const normalizer = getAdaptiveNormalizer();
    return normalizer.getShaderValuesAtTime(time);
}

export default AdaptiveAudioNormalizer;
