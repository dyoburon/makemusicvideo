const colorfulCirclesShaderSource = `#version 300 es
precision highp float;

// Standard uniforms
uniform vec2 uResolution;
uniform float uTime;

// Audio analysis uniforms
uniform float uTransients;   // Beat detection
uniform float uEnergy;       // Overall audio energy
uniform float uLowEnergy;    // Low frequency energy
uniform float uHighEnergy;   // High frequency energy

// Effect intensity uniforms
uniform float uTransientIntensity;    // Overall intensity of transient effects
uniform float uEnergyCameraEffect;    // How much energy affects camera
uniform float uEnergyColorEffect;     // How much energy affects colors
uniform float uTransientCameraEffect; // How much transients affect camera
uniform float uTransientColorEffect;  // How much transients affect colors

// Tunnel breathing effect uniforms
uniform float uBreathingRate;         // Controls how fast the tunnel breathes
uniform float uBreathingAmount;       // Controls how much the tunnel expands/contracts

// Color uniforms
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uFogColor;
uniform vec3 uGlowColor;

// Additional uniform for offset (replaces 'm')
uniform vec2 uOffset;

// Output color
out vec4 fragColor;

// Smooth step function for transitions (from retro tunnel shader)
float smootherstep(float edge0, float edge1, float x) {
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

void main() {
    // Normalize fragment coordinates
    vec2 normalizedCoord = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
    
    // Apply audio-reactive offset
    vec2 audioOffset = uOffset;
    // Subtle horizontal shift with low frequencies
    audioOffset.x += sin(uTime * 0.3) * 0.01 * (1.0 + uLowEnergy * uEnergyCameraEffect * 0.05);
    // Subtle vertical shift with high frequencies
    audioOffset.y += cos(uTime * 0.4) * 0.005 * uHighEnergy * uEnergyCameraEffect * 0.05;
    // Transient-driven micro-shifts
    audioOffset += uTransients * uTransientIntensity * uTransientCameraEffect * 0.005;
    
    vec2 p = normalizedCoord - audioOffset;
    
    // Main loop
    for (int i = 0; i < 8; ++i) {
        // Compute scalar with breathing effect
        float breathingPhase = sin(uTime * uBreathingRate);
        float breathingFactor = 1.0 + uBreathingAmount * 0.01 * (1.0 + breathingPhase); // Very subtle
        float scalar = dot(p, p) * breathingFactor;
        // Add transient-driven expansion
        scalar *= 1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.005;
        
        p = abs(p) / scalar;
        
        // Dynamic offset with audio reactivity
        float offsetBase = 0.9 + cos(uTime * 0.2) * 0.4;
        float offsetAudio = offsetBase * (1.0 + uEnergy * uEnergyCameraEffect * 0.01 + 
                                         uTransients * uTransientIntensity * uTransientCameraEffect * 0.005);
        p -= vec2(offsetAudio, offsetAudio);
    }
    
    // Color calculation
    vec3 baseColor;
    // Blend colors based on p.x and p.y
    float colorMix = smootherstep(-1.0, 1.0, p.x + p.y);
    if (colorMix < 0.33) {
        baseColor = uColor1;
    } else if (colorMix < 0.66) {
        baseColor = uColor2;
    } else {
        baseColor = uColor3;
    }
    
    // Subtle audio-reactive color shifts
    if (uTransients * uTransientIntensity * uTransientColorEffect > 0.1) {
        baseColor *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.05; // Faint brightness
    }
    if (uLowEnergy * uEnergyColorEffect > 0.3) {
        baseColor.r *= 1.0 + uLowEnergy * uEnergyColorEffect * 0.02; // Faint warmth
    }
    if (uHighEnergy * uEnergyColorEffect > 0.3) {
        baseColor.b *= 1.0 + uHighEnergy * uEnergyColorEffect * 0.02; // Faint coolness
    }
    
    // Retro post-processing
    vec3 col = baseColor;
    // Subtle vignette
    vec2 q = gl_FragCoord.xy / uResolution;
    float vignetteStrength = 0.6 + uEnergy * uEnergyColorEffect * 0.05;
    // col *= pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.1) * vignetteStrength + 0.4; // Disabled for subtlety
    
    // Subtle scanlines
    float scanlineIntensity = 0.05 * (1.0 + uHighEnergy * uEnergyColorEffect * 0.1);
    float scanlineStrength = 0.95 + scanlineIntensity * sin(gl_FragCoord.y * 0.5 + uTime * 0.2);
    // col *= scanlineStrength; // Disabled for subtlety
    
    // Subtle glow
    vec3 audioReactiveGlow = uGlowColor * (uTransients * uTransientIntensity * uTransientColorEffect * 0.1 + 
                                          uLowEnergy * uEnergyColorEffect * 0.05 + 
                                          uHighEnergy * uEnergyColorEffect * 0.05);
    col += audioReactiveGlow * 0.2; // Very faint glow
    
    // Final output
    fragColor = vec4(col * (1.0 + uEnergy * uEnergyColorEffect * 0.01), 1.0);
}`;

export default colorfulCirclesShaderSource;
