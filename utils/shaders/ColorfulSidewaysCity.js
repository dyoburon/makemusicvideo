const colorfulSidewaysCityShaderSource = `#version 300 es
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

// Camera speed uniform
uniform float uCameraSpeed;           // Controls movement speed through tunnel

// Color uniforms
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uFogColor;
uniform vec3 uGlowColor;

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

    // Subtle camera modulation based on audio
    float timeScale = 1.0 + uEnergy * uEnergyCameraEffect * 0.01; // Extremely subtle speed variation
    float audioTime = uTime * uCameraSpeed * timeScale;

    // Breathing effect for subtle tunnel scaling
    float breathingPhase = sin(audioTime * uBreathingRate);
    float breathingFactor = 1.0 + uBreathingAmount * breathingPhase * 0.01; // Very subtle scaling

    vec4 totalColor = vec4(0.0); // Accumulator for the color
    float z = 0.0; // Accumulator for distance/depth parameter

    // Main loop
    for (float i = 1.0; i <= 100.0; i++) {
        // Calculate position 'p'
        vec3 p = z * rayDirection;

        // Subtle audio-reactive displacement
        float lowFreqShift = uLowEnergy * uEnergyCameraEffect * 0.005; // Tiny positional shift
        p.z += 9.0 + lowFreqShift;

        // Transform 'p' with subtle audio influence
        float l = length(p);
        float transientShift = uTransients * uTransientIntensity * uTransientCameraEffect * 0.005; // Minimal transient effect
        p = vec3(
            atan(p.z, p.x) - audioTime * 0.1 + transientShift,
            log(l) - audioTime * 0.2 * breathingFactor,
            asin(p.y / l)
        ) / 0.1;

        // Compute 'v' with subtle high-frequency influence
        float highFreqMod = 1.0 + uHighEnergy * uEnergyCameraEffect * 0.005; // Tiny pattern variation
        vec3 v = cos(p + sin(p / 0.24 + audioTime) * highFreqMod);

        // Compute distance step 'd'
        float d = (l / 60.0) * length(max(v, v.yzx * 0.1));

        // Update 'z'
        z += d;

        // Accumulate color with audio-reactive color selection
        vec3 baseColor = uColor1; // Default color
        if (p.y > 0.5) baseColor = uColor2; // Second color zone
        if (p.y > 1.0) baseColor = uColor3; // Third color zone

        // Subtle color modulation
        float colorPulse = 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.01; // Tiny brightness pulse
        vec4 color_contribution = (sin(p.y + vec4(6.0, 1.0, 3.0, 3.0)) + 1.0) / d;
        color_contribution.rgb *= baseColor * colorPulse;

        // Subtle fog effect
        float fogStrength = 0.05 + uHighEnergy * uEnergyColorEffect * 0.005; // Minimal fog variation
        vec4 fog = vec4(uFogColor, 1.0) * exp(-z * fogStrength);
        color_contribution += fog * 0.02; // Very subtle fog contribution

        totalColor += color_contribution;
    }

    // Final tonemapping
    totalColor = tanh(totalColor / 20000.0);

    // Subtle glow effect
    vec3 glow = uGlowColor * (uTransients * uTransientIntensity * uTransientColorEffect * 0.05 + uEnergy * uEnergyColorEffect * 0.02);
    totalColor.rgb += glow;

    // Set final fragment color
    fragColor = vec4(totalColor.rgb, 1.0);
}
`;

export default colorfulSidewaysCityShaderSource;
