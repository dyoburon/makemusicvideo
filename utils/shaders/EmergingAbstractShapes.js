const emergingAbstractShapesShaderSource = `#version 300 es
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
uniform vec3 uColor1;  // Primary color
uniform vec3 uColor2;  // Secondary color
uniform vec3 uColor3;  // Tertiary color
uniform vec3 uFogColor; // Fog color
uniform vec3 uGlowColor; // Glow color

// Output color
out vec4 fragColor;

// Helper function for rotation
mat2 rot(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, s, -s, c);
}

void main() {
    // Calculate ray direction based on fragment coordinates
    vec3 rayDirection = normalize(vec3(gl_FragCoord.xy * 2.0 - uResolution.xy, -uResolution.y));

    vec4 totalColor = vec4(0.0); // Accumulator for the color
    float z = 0.0; // Accumulator for distance/depth parameter
    vec3 p, v; // Position and auxiliary vector

    // Subtle audio-reactive time scale (affects movement speed)
    float timeScale = 1.0 + uEnergy * uEnergyCameraEffect * 0.01 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.005;
    float audioTime = uTime * timeScale;

    // Subtle camera displacement based on low and high frequencies
    vec2 cameraOffset = vec2(
        sin(audioTime * 0.1) * uLowEnergy * uEnergyCameraEffect * 0.01,
        cos(audioTime * 0.1) * uHighEnergy * uEnergyCameraEffect * 0.01
    );

    // Main loop
    for (float i = 1.0; i <= 100.0; i++) {
        // Calculate position
        p = z * rayDirection;
        p.z -= audioTime; // Apply audio-reactive time
        p.xy += cameraOffset; // Apply subtle camera offset

        // Subtle breathing effect
        float breathingPhase = sin(audioTime * uBreathingRate);
        float breathingFactor = 1.0 + uBreathingAmount * breathingPhase * 0.01; // Very subtle scaling
        p.xy *= breathingFactor;

        // Apply rotation with subtle audio influence
        float angle = p.z * 0.1 * (1.0 + uHighEnergy * uEnergyCameraEffect * 0.005);
        p.xy *= rot(angle);

        // Calculate v with subtle low-frequency modulation
        float audioMod = 1.0 + uLowEnergy * uEnergyCameraEffect * 0.005;
        v = cos(p + sin(p.yzx / (0.3 * audioMod)));
        v = max(v, v.zxy * 0.1);

        // Calculate distance step with subtle transient influence
        float transientMod = 1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.005;
        float dist_step = length(v) / (6.0 * transientMod);
        z += dist_step;

        // Accumulate color with audio-reactive color modulation
        vec3 baseColor = mix(uColor1, uColor2, sin(p.z * 0.1) * 0.5 + 0.5);
        baseColor = mix(baseColor, uColor3, uHighEnergy * uEnergyColorEffect * 0.1);
        
        // Subtle color pulsing with transients
        float pulse = 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.05;
        vec4 color_contribution = vec4(baseColor * pulse, 1.0) * (cos(p.z + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / dist_step;
        
        // Subtle glow effect
        color_contribution.rgb += uGlowColor * uTransients * uTransientIntensity * uTransientColorEffect * 0.02;
        
        totalColor += color_contribution;
    }

    // Final tonemapping
    totalColor = tanh(totalColor / 5000.0);

    // Subtle fog effect
    float fogStrength = 0.01 + uHighEnergy * uEnergyCameraEffect * 0.005;
    vec3 foggedColor = mix(totalColor.rgb, uFogColor, 1.0 - exp(-z * fogStrength));

    // Final fragment color with subtle energy-based saturation boost
    vec3 finalColor = foggedColor * (1.0 + uEnergy * uEnergyColorEffect * 0.01);
    fragColor = vec4(finalColor, 1.0);
}`;

export default emergingAbstractShapesShaderSource;