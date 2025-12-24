import { useState, useCallback, useRef, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/AudioAnalyzer.module.css';
import { analyzeAudioFile } from '../utils/audio/audioAnalyzer';

/**
 * Waveform visualization component with transient markers
 */
function WaveformVisualizer({ audioData, transients, currentTime }) {
    const canvasRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [zoomLevel, setZoomLevel] = useState(1);
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startDragX, setStartDragX] = useState(0);
    const [startOffsetX, setStartOffsetX] = useState(0);

    // Set canvas dimensions on mount
    useEffect(() => {
        if (canvasRef.current) {
            const { width } = canvasRef.current.getBoundingClientRect();
            setDimensions({ width, height: 200 });
        }
    }, []);

    // Reset offset when zoom changes to keep center
    useEffect(() => {
        if (zoomLevel === 1) {
            setOffsetX(0);
        } else {
            // Keep offset within bounds
            const maxOffset = (dimensions.width * (zoomLevel - 1)) / zoomLevel;
            if (offsetX > maxOffset) {
                setOffsetX(maxOffset);
            }
        }
    }, [zoomLevel, dimensions.width]);

    // Handle zoom in/out
    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 0.5, 10));
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 0.5, 1));
    };

    const handleZoomReset = () => {
        setZoomLevel(1);
        setOffsetX(0);
    };

    // Handle panning when zoomed in
    const handleMouseDown = (e) => {
        if (zoomLevel > 1) {
            setIsDragging(true);
            setStartDragX(e.clientX);
            setStartOffsetX(offsetX);
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging && zoomLevel > 1) {
            const dx = (e.clientX - startDragX) / zoomLevel;
            let newOffset = startOffsetX - dx;

            // Constrain offset within bounds
            const maxOffset = (dimensions.width * (zoomLevel - 1)) / zoomLevel;
            newOffset = Math.max(0, Math.min(newOffset, maxOffset));

            setOffsetX(newOffset);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleWheel = (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            // Zoom in on wheel up
            setZoomLevel(prev => Math.min(prev + 0.5, 10));
        } else {
            // Zoom out on wheel down
            setZoomLevel(prev => Math.max(prev - 0.5, 1));
        }
    };

    // Draw waveform and markers
    useEffect(() => {
        if (!audioData || !canvasRef.current || !dimensions.width || !dimensions.height) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { width, height } = dimensions;

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, height);

        const { samples, duration } = audioData;
        if (!samples || !samples.length) return;

        // Calculate zoom-adjusted dimensions
        const visibleWidth = width / zoomLevel;
        const startX = offsetX;
        const endX = startX + visibleWidth;

        // Calculate time range
        const startTime = (startX / width) * duration;
        const endTime = (endX / width) * duration;
        const visibleDuration = endTime - startTime;

        // Draw waveform
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.beginPath();

        const centerY = height / 2;
        let firstPoint = true;

        // Filter samples to only those in visible range
        const visibleSamples = samples.filter(sample =>
            sample.time >= startTime && sample.time <= endTime
        );

        // Draw top of waveform
        visibleSamples.forEach((sample, i) => {
            const timeRatio = (sample.time - startTime) / visibleDuration;
            const x = timeRatio * width;
            const y = centerY - (sample.value * centerY * 0.9);

            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        });

        // Mirror the top waveform to the bottom
        const reversedSamples = [...visibleSamples].reverse();
        reversedSamples.forEach(sample => {
            const timeRatio = (sample.time - startTime) / visibleDuration;
            const x = timeRatio * width;
            const y = centerY + (sample.value * centerY * 0.9);
            ctx.lineTo(x, y);
        });

        ctx.closePath();
        ctx.fillStyle = 'rgba(37, 99, 235, 0.1)';
        ctx.fill();

        // Draw the outline
        ctx.beginPath();
        firstPoint = true;
        visibleSamples.forEach((sample, i) => {
            const timeRatio = (sample.time - startTime) / visibleDuration;
            const x = timeRatio * width;
            const y = centerY - (sample.value * centerY * 0.8);

            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw the bottom outline
        ctx.beginPath();
        firstPoint = true;
        visibleSamples.forEach((sample, i) => {
            const timeRatio = (sample.time - startTime) / visibleDuration;
            const x = timeRatio * width;
            const y = centerY + (sample.value * centerY * 0.8);

            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw time markers
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';

        // Adjust interval based on zoom level
        const baseInterval = 5;
        const adjustedInterval = Math.max(1, Math.round(baseInterval / zoomLevel));

        // Find the first marker in view
        const firstMarkerTime = Math.ceil(startTime / adjustedInterval) * adjustedInterval;

        for (let i = firstMarkerTime; i <= endTime; i += adjustedInterval) {
            const timeRatio = (i - startTime) / visibleDuration;
            const x = timeRatio * width;

            // Draw tick mark
            ctx.beginPath();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1;
            ctx.moveTo(x, height - 20);
            ctx.lineTo(x, height);
            ctx.stroke();

            // Draw time label
            const minutes = Math.floor(i / 60);
            const seconds = Math.floor(i % 60);
            const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            ctx.fillText(timeLabel, x - 10, height - 5);
        }

        // Draw transient markers as vertical lines (similar to playback position)
        if (transients && transients.length) {
            const visibleTransients = transients.filter(
                transient => transient.time >= startTime && transient.time <= endTime
            );

            visibleTransients.forEach(transient => {
                const timeRatio = (transient.time - startTime) / visibleDuration;
                const x = timeRatio * width;

                // Draw a vertical line for each transient
                ctx.beginPath();
                ctx.strokeStyle = getTransientColor(transient.subtype || 'default');
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]); // Make a dashed line to distinguish from playback
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
                ctx.setLineDash([]); // Reset to solid line

                // Add a visible dot at the top for emphasis
                ctx.beginPath();
                ctx.fillStyle = getTransientColor(transient.subtype || 'default');
                ctx.arc(x, 10, 5, 0, Math.PI * 2);
                ctx.fill();

                // Add band indicator text
                ctx.fillStyle = getTransientColor(transient.subtype || 'default');
                ctx.font = 'bold 10px sans-serif';
                let bandLabel = 'L'; // Default to L for low
                if (transient.subtype === 'mid') bandLabel = 'M';
                if (transient.subtype === 'high') bandLabel = 'H';
                ctx.fillText(bandLabel, x - 3, 30);
            });
        }

        // Draw current time position as a clear red vertical line with circle
        if (currentTime !== undefined && currentTime >= startTime && currentTime <= endTime) {
            const timeRatio = (currentTime - startTime) / visibleDuration;
            const x = timeRatio * width;

            // Draw vertical position line
            ctx.beginPath();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3; // Make it thicker than transient lines
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            // Draw playhead handle
            ctx.beginPath();
            ctx.fillStyle = '#ef4444';
            ctx.arc(x, centerY, 8, 0, Math.PI * 2);
            ctx.fill();

            // Add white outline
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw zoom indicator
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Zoom: ${zoomLevel.toFixed(1)}x`, 10, 20);

        // Draw time range
        ctx.fillText(`Range: ${formatTime(startTime)} - ${formatTime(endTime)}`, width - 150, 20);

    }, [audioData, transients, dimensions, currentTime, zoomLevel, offsetX]);

    // Format time in seconds to mm:ss format
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Helper function to get color based on frequency band
    const getTransientColor = (band) => {
        switch (band) {
            case 'low': return '#7e22ce'; // purple
            case 'mid': return '#fb923c'; // orange
            case 'high': return '#facc15'; // yellow
            default: return '#0ea5e9'; // blue
        }
    };

    return (
        <div className={styles.waveformContainer}>
            <div className={styles.zoomControls}>
                <button onClick={handleZoomOut} disabled={zoomLevel <= 1}>-</button>
                <button onClick={handleZoomReset}>Reset</button>
                <button onClick={handleZoomIn} disabled={zoomLevel >= 10}>+</button>
                <span className={styles.zoomLevel}>{zoomLevel.toFixed(1)}x</span>
                {zoomLevel > 1 && <span className={styles.panHint}>Click and drag to pan</span>}
            </div>

            <canvas
                ref={canvasRef}
                className={styles.waveformCanvas}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
                style={{ cursor: zoomLevel > 1 ? 'grab' : 'default' }}
            />

            <div className={styles.waveformLegend}>
                <div className={styles.legendItem}>
                    <span className={styles.legendColor} style={{ backgroundColor: '#7e22ce' }}></span>
                    <span>Low Frequency Transients (L)</span>
                </div>
                <div className={styles.legendItem}>
                    <span className={styles.legendColor} style={{ backgroundColor: '#fb923c' }}></span>
                    <span>Mid Frequency Transients (M)</span>
                </div>
                <div className={styles.legendItem}>
                    <span className={styles.legendColor} style={{ backgroundColor: '#facc15' }}></span>
                    <span>High Frequency Transients (H)</span>
                </div>
                <div className={styles.legendItem}>
                    <span className={styles.legendColor} style={{ backgroundColor: '#ef4444' }}></span>
                    <span>Current Playback Position</span>
                </div>
            </div>
        </div>
    );
}

export default function AudioAnalyzerTest() {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzeProgress, setAnalyzeProgress] = useState(0);
    const [analyzeStatus, setAnalyzeStatus] = useState('');
    const [results, setResults] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeEvents, setActiveEvents] = useState([]);
    const [thresholds, setThresholds] = useState({
        energy: 0.7,
        spectralFlux: 2.0,
        lowFrequency: 0.8,
        lowFreqOnsetThreshold: 0.0,
        midFreqOnsetThreshold: 0.0,
        highFreqOnsetThreshold: 0.0
    });

    // Handle file drop
    const onDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        // Find audio file
        const audioFile = files.find(f =>
            f.type.startsWith('audio/')
        );

        if (!audioFile) {
            setAnalyzeStatus('No valid audio file found. Please upload an MP3, WAV, or OGG file.');
            return;
        }

        setFile(audioFile);
        handleAudioFile(audioFile);
    }, []);

    // Handle file selection via input
    const onFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const audioFile = files[0];
        setFile(audioFile);
        handleAudioFile(audioFile);
    };

    // Process the audio file
    const handleAudioFile = (file) => {
        setIsAnalyzing(true);
        setAnalyzeStatus('Loading audio file...');
        setAnalyzeProgress(0);
        setResults(null);

        // Create audio URL for playback
        const url = URL.createObjectURL(file);
        setAudioUrl(url);

        // Run analysis
        setAnalyzeStatus('Analyzing audio features...');

        // Use a timeout to allow UI to update before starting analysis
        setTimeout(async () => {
            try {
                // Run the analysis with current thresholds
                const analysisResults = await analyzeAudioFile(file, {
                    // Pass current threshold values to analyzer
                    lowFreqOnsetThreshold: thresholds.lowFreqOnsetThreshold,
                    midFreqOnsetThreshold: thresholds.midFreqOnsetThreshold,
                    highFreqOnsetThreshold: thresholds.highFreqOnsetThreshold
                });

                // Update state with results
                setResults(analysisResults);
                setAnalyzeStatus('Analysis complete!');
                setIsAnalyzing(false);
                setAnalyzeProgress(100);

                console.log('Analysis results:', analysisResults);
                if (analysisResults.timeline) {
                    const transients = analysisResults.timeline.filter(e => e.type === 'transient');
                    console.log(`Found ${transients.length} transients in timeline`);
                    // Log the first transient to see its structure
                    if (transients.length > 0) {
                        console.log('Transient structure example:', transients[0]);
                        console.log('Available properties:', Object.keys(transients[0]));
                    }
                }
            } catch (error) {
                console.error('Error analyzing audio:', error);
                setAnalyzeStatus(`Error: ${error.message}`);
                setIsAnalyzing(false);
            }
        }, 100);
    };

    // Format time in seconds to mm:ss format
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Track audio playback time
    useEffect(() => {
        if (!audioRef.current) return;

        const updateTime = () => {
            setCurrentTime(audioRef.current.currentTime);
        };

        const updatePlayStatus = () => {
            setIsPlaying(!audioRef.current.paused);
        };

        audioRef.current.addEventListener('timeupdate', updateTime);
        audioRef.current.addEventListener('play', updatePlayStatus);
        audioRef.current.addEventListener('pause', updatePlayStatus);
        audioRef.current.addEventListener('ended', updatePlayStatus);

        return () => {
            if (audioRef.current) {
                audioRef.current.removeEventListener('timeupdate', updateTime);
                audioRef.current.removeEventListener('play', updatePlayStatus);
                audioRef.current.removeEventListener('pause', updatePlayStatus);
                audioRef.current.removeEventListener('ended', updatePlayStatus);
            }
        };
    }, [audioRef.current]);

    // Find active events based on current playback time
    useEffect(() => {
        if (!results || !isPlaying) return;

        // Find events that are active at the current time (within a small window)
        const timeWindow = 0.2; // 200ms window
        const currentEvents = results.timeline.filter(
            event => Math.abs(event.time - currentTime) < timeWindow
        );

        if (currentEvents.length > 0) {
            setActiveEvents(currentEvents);
            console.log('Active events at', currentTime, currentEvents);
        } else {
            setActiveEvents([]);
        }
    }, [currentTime, results, isPlaying]);

    // Handle threshold changes
    const handleThresholdChange = (type, value) => {
        const newValue = parseFloat(value);
        setThresholds(prev => ({
            ...prev,
            [type]: newValue
        }));

        // We'll only reanalyze when the Apply button is clicked
        // This makes the UI more responsive for slider changes
    };

    // Track timeout for threshold updates
    const [thresholdUpdateTimeout, setThresholdUpdateTimeout] = useState(null);

    // Re-analyze audio with updated thresholds
    const reanalyzeAudio = () => {
        if (!file && !results) return;

        setIsAnalyzing(true);
        setAnalyzeStatus('Updating analysis with new thresholds...');

        // Use timeout to allow UI to update
        setTimeout(async () => {
            try {
                // Run the analysis with updated thresholds - note we pass null for audioFile
                // since we're reanalyzing existing data
                const analysisResults = await analyzeAudioFile(null, {
                    lowFreqOnsetThreshold: thresholds.lowFreqOnsetThreshold,
                    midFreqOnsetThreshold: thresholds.midFreqOnsetThreshold,
                    highFreqOnsetThreshold: thresholds.highFreqOnsetThreshold
                });

                // Update state with new results
                setResults(analysisResults);
                setAnalyzeStatus('Analysis updated!');
                setIsAnalyzing(false);

                console.log('Updated analysis with new thresholds:', {
                    lowFreqOnsetThreshold: thresholds.lowFreqOnsetThreshold,
                    midFreqOnsetThreshold: thresholds.midFreqOnsetThreshold,
                    highFreqOnsetThreshold: thresholds.highFreqOnsetThreshold
                });
                console.log(`Found ${analysisResults.timeline.filter(e => e.type === 'transient').length} transients with new thresholds`);
            } catch (error) {
                console.error('Error updating analysis:', error);
                setAnalyzeStatus(`Error updating: ${error.message}`);
                setIsAnalyzing(false);
            }
        }, 50);
    };

    // Toggle play/pause
    const togglePlayback = () => {
        if (!audioRef.current) return;

        if (audioRef.current.paused) {
            audioRef.current.play();
        } else {
            audioRef.current.pause();
        }
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>Audio Analyzer Test</title>
                <meta name="description" content="Test the audio analyzer for music feature extraction" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <header className={styles.header}>
                <h1>Audio Feature Analyzer</h1>
                <p>Upload an audio file to analyze its features for animation synchronization</p>
            </header>

            <main className={styles.main}>
                {/* Upload Section */}
                <div className={styles.uploadSection}>
                    <h2>Upload Audio File</h2>
                    <div
                        className={`${styles.uploadArea} ${isDragging ? styles.dragging : ''}`}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={onDrop}
                    >
                        {!file ? (
                            <>
                                <div className={styles.uploadIcon}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                </div>
                                <p>Drag and drop your audio file here, or</p>
                                <label className={styles.fileInputLabel}>
                                    Browse Files
                                    <input
                                        type="file"
                                        accept="audio/*"
                                        onChange={onFileSelect}
                                        className={styles.fileInput}
                                    />
                                </label>
                            </>
                        ) : (
                            <div className={styles.uploadProgress}>
                                <h3>{file.name}</h3>
                                <div className={styles.progressContainer}>
                                    <div
                                        className={styles.progressBar}
                                        style={{ width: `${analyzeProgress}%` }}
                                    ></div>
                                </div>
                                <p className={styles.statusText}>{analyzeStatus}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Audio Player */}
                {audioUrl && (
                    <div className={styles.audioPlayerSection}>
                        <h2>Audio Playback</h2>
                        <div className={styles.audioPlayer}>
                            <audio ref={audioRef} src={audioUrl} controls preload="metadata" />
                            <div className={styles.playbackControls}>
                                <button onClick={togglePlayback} className={styles.playButton}>
                                    {isPlaying ? 'Pause' : 'Play'}
                                </button>
                                <div className={styles.timeDisplay}>
                                    {formatTime(currentTime)} / {audioRef.current ? formatTime(audioRef.current.duration || 0) : '0:00'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Waveform Visualization */}
                {results && results.audioData && (
                    <div className={styles.waveformSection}>
                        <h2>Audio Waveform with Transient Markers</h2>
                        <WaveformVisualizer
                            audioData={results.audioData}
                            transients={results.timeline ? results.timeline.filter(event => event.type === 'transient') : []}
                            currentTime={currentTime}
                        />
                    </div>
                )}

                {/* Analysis Settings */}
                <div className={styles.settingsSection}>
                    <h2>Analysis Settings</h2>
                    <div className={styles.thresholdControls}>
                        <div className={styles.thresholdControl}>
                            <label>Energy Threshold:</label>
                            <input
                                type="range"
                                min="0.1"
                                max="2.0"
                                step="0.1"
                                value={thresholds.energy}
                                onChange={(e) => handleThresholdChange('energy', e.target.value)}
                            />
                            <span>{thresholds.energy}</span>
                        </div>
                        <div className={styles.thresholdControl}>
                            <label>Spectral Flux Threshold:</label>
                            <input
                                type="range"
                                min="0.5"
                                max="5.0"
                                step="0.1"
                                value={thresholds.spectralFlux}
                                onChange={(e) => handleThresholdChange('spectralFlux', e.target.value)}
                            />
                            <span>{thresholds.spectralFlux}</span>
                        </div>
                        <div className={styles.thresholdControl}>
                            <label>Low Frequency Threshold:</label>
                            <input
                                type="range"
                                min="0.1"
                                max="2.0"
                                step="0.1"
                                value={thresholds.lowFrequency}
                                onChange={(e) => handleThresholdChange('lowFrequency', e.target.value)}
                            />
                            <span>{thresholds.lowFrequency}</span>
                        </div>
                        <div className={styles.thresholdControl}>
                            <label>Low Frequency Onset Threshold:</label>
                            <input
                                type="range"
                                min="0.000"
                                max="5.000"
                                step="0.001"
                                value={thresholds.lowFreqOnsetThreshold}
                                onChange={(e) => handleThresholdChange('lowFreqOnsetThreshold', e.target.value)}
                            />
                            <span>{thresholds.lowFreqOnsetThreshold.toFixed(3)}</span>
                        </div>
                        <div className={styles.thresholdControl}>
                            <label>Mid Frequency Onset Threshold:</label>
                            <input
                                type="range"
                                min="0.000"
                                max="5.000"
                                step="0.001"
                                value={thresholds.midFreqOnsetThreshold}
                                onChange={(e) => handleThresholdChange('midFreqOnsetThreshold', e.target.value)}
                            />
                            <span>{thresholds.midFreqOnsetThreshold.toFixed(3)}</span>
                        </div>
                        <div className={styles.thresholdControl}>
                            <label>High Frequency Onset Threshold:</label>
                            <input
                                type="range"
                                min="0.000"
                                max="5.000"
                                step="0.001"
                                value={thresholds.highFreqOnsetThreshold}
                                onChange={(e) => handleThresholdChange('highFreqOnsetThreshold', e.target.value)}
                            />
                            <span>{thresholds.highFreqOnsetThreshold.toFixed(3)}</span>
                        </div>
                        <div className={styles.applyThresholds}>
                            <button
                                onClick={reanalyzeAudio}
                                disabled={isAnalyzing || !file}
                                className={styles.applyButton}
                            >
                                {isAnalyzing ? 'Updating...' : 'Apply Threshold Changes'}
                            </button>
                            <p className={styles.thresholdNote}>
                                {file ?
                                    'Adjust thresholds to filter transients and click Apply to update visualization' :
                                    'Upload an audio file first to analyze with these settings'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Results Display */}
                {results && (
                    <div className={styles.resultsSection}>
                        <h2>Analysis Results</h2>

                        <div className={styles.summaryResults}>
                            <div className={styles.resultItem}>
                                <h3>Track Duration: {formatTime(results.duration)}</h3>
                            </div>
                            {results.tempo && (
                                <div className={styles.resultItem}>
                                    <h3>Tempo: {results.tempo.bpm} BPM</h3>
                                    <p>Beat Interval: {results.tempo.beatInterval.toFixed(3)}s</p>
                                </div>
                            )}
                            <div className={styles.resultItem}>
                                <h3>Events Detected:</h3>
                                <ul>
                                    <li>Drops: {results.timeline.filter(e => e.type === 'drop').length}</li>
                                    <li>Beats: {results.timeline.filter(e => e.type === 'beat').length}</li>
                                    <li>Bass: {results.timeline.filter(e => e.type === 'bass').length}</li>
                                    <li>Transients: {results.timeline.filter(e => e.type === 'transient').length}</li>
                                    <li>Beat Grid: {results.timeline.filter(e => e.type === 'grid_beat').length}</li>
                                    <li>Dynamic Changes: {results.timeline.filter(e => e.type.startsWith('dynamic_')).length}</li>
                                    <li>Timbre Changes: {results.timeline.filter(e => e.type === 'timbre').length}</li>
                                </ul>
                            </div>
                        </div>

                        {/* Timeline Visualization */}
                        <div className={styles.timelineVisualization}>
                            <h3>Event Timeline</h3>
                            <div className={styles.timeline}>
                                <div className={styles.timelineHeader}>
                                    <span>Time</span>
                                    <span>Type</span>
                                    <span>Intensity</span>
                                    <span>Raw Value</span>
                                    <span>RMS Change</span>
                                    <span>Dominant Value</span>
                                    <span>Animation</span>
                                </div>
                                <div className={styles.timelineBody}>
                                    {results.timeline
                                        .filter(event => event.type === 'transient')
                                        .map((event, index) => {
                                            // Get display type for event
                                            let displayType = event.type;
                                            if (event.type === 'transient' && event.subtype) {
                                                displayType = `${event.type} (${event.subtype})`;
                                            }

                                            // Add debug output to console to check all available properties
                                            if (index === 0) {
                                                console.log('Transient properties:', Object.keys(event));
                                                console.log('Full transient object:', event);
                                            }

                                            return (
                                                <div
                                                    key={`${event.type}-${index}`}
                                                    className={`${styles.timelineEvent} ${activeEvents.includes(event) ? styles.activeEvent : ''}`}
                                                >
                                                    <span>{formatTime(event.time)}</span>
                                                    <span className={
                                                        styles[event.type] ||
                                                        styles[event.subtype] ||
                                                        styles[event.type.split('_')[0]] ||
                                                        styles.default
                                                    }>{displayType}</span>
                                                    <span>{event.intensity ? event.intensity.toFixed(2) : 'N/A'}</span>
                                                    <span>{event.value ? event.value.toFixed(3) : 'N/A'}</span>
                                                    <span>{event.rmsChange ? event.rmsChange.toFixed(3) : 'N/A'}</span>
                                                    <span>{event.dominantValue ? event.dominantValue.toFixed(3) : 'N/A'}</span>
                                                    <span>
                                                        {event.suggestedAnimation && (
                                                            <ul className={styles.animationSuggestions}>
                                                                {Object.entries(event.suggestedAnimation).map(([key, value]) => (
                                                                    <li key={key}>{key}: {typeof value === 'boolean' ? value : typeof value === 'number' ? value.toFixed(2) : value}</li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>

                        {/* Current Active Events */}
                        <div className={styles.activeEventsSection}>
                            <h3>Currently Active Events</h3>
                            {activeEvents.length > 0 ? (
                                <div className={styles.activeEventsList}>
                                    {activeEvents.map((event, index) => (
                                        <div key={index} className={`${styles.activeEventCard} ${styles[`${event.type}Card`] || styles.defaultCard}`}>
                                            <h4>{event.type} at {formatTime(event.time)}</h4>
                                            <p>Intensity: {event.intensity ? event.intensity.toFixed(3) : 'N/A'}</p>
                                            {event.value && <p>Value: {event.value.toFixed(3)}</p>}
                                            {event.rmsChange && <p>RMS Change: {event.rmsChange.toFixed(3)}</p>}
                                            {event.dominantValue && <p>Dominant Value: {event.dominantValue.toFixed(3)}</p>}
                                            {event.suggestedAnimation && (
                                                <div className={styles.suggestedAnimationParams}>
                                                    <h5>Suggested Animation:</h5>
                                                    <pre>{JSON.stringify(event.suggestedAnimation, null, 2)}</pre>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p>No events active at current time ({formatTime(currentTime)})</p>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <footer className={styles.footer}>
                <p>Audio Analyzer Testing Tool</p>
            </footer>
        </div>
    );
}
