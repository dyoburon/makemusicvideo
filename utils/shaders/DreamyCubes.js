const dreamyCubesShaderSource = `#version 300 es
precision highp float;

// Standard uniforms
uniform vec2 uResolution;
uniform float uTime;

// Audio analysis uniforms
uniform float uEnergy;       // Overall audio energy
uniform float uLowEnergy;    // Low frequency energy
uniform float uHighEnergy;   // High frequency energy
uniform float uTransients;   // Beat detection

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
uniform vec3 uColor1;     // Primary color
uniform vec3 uColor2;     // Secondary color
uniform vec3 uColor3;     // Tertiary color
uniform vec3 uFogColor;   // Fog color
uniform vec3 uGlowColor;  // Glow color

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
    vec3 rayDirection = normalize(vec3(gl_FragCoord.xy * 2.0 - uResolution.xy, -uResolution.x));

    // Subtle camera shift based on low and high frequencies
    vec2 cameraOffset = vec2(0.0);
    cameraOffset.x += uLowEnergy * uEnergyCameraEffect * 0.02;  // Extremely subtle horizontal shift with bass
    cameraOffset.y += uHighEnergy * uEnergyCameraEffect * 0.01; // Extremely subtle vertical shift with treble
    rayDirection.xy += cameraOffset;

    vec4 totalColor = vec4(0.0); // Accumulator for the color
    float z = 0.0; // Accumulator for distance/depth parameter

    // Subtle breathing effect for depth scaling
    float breathingPhase = sin(uTime * uBreathingRate);
    float breathingFactor = 1.0 + uBreathingAmount * (0.01 + 0.01 * breathingPhase); // Very subtle expansion

    // Subtle transient-based time modulation
    float timeScale = 1.0 + uTransients * uTransientCameraEffect * 0.005; // Extremely subtle speed-up on beats
    float effectiveTime = uTime * timeScale;

    // Main loop
    for (float i = 1.0; i <= 80.0; i++) {
        // Calculate position
        vec3 p = z * rayDirection * breathingFactor; // Apply breathing to depth

        // Apply time-based offset with subtle transient influence
        p.xz -= effectiveTime;

        // Subtle y-position modulation with low energy
        float yMod = 1.0 + uLowEnergy * uEnergyCameraEffect * 0.01; // Subtle height adjustment
        p.y = (4.0 - abs(p.y)) * yMod;

        // Inner loop
        float inner_step;
        for (inner_step = 0.7; inner_step < 20.0; inner_step /= 0.5) {
            // Subtle high-frequency distortion
            float distortion = 1.0 + uHighEnergy * uEnergyCameraEffect * 0.005;
            p += cos(round(p.yzx * inner_step * distortion) - 0.2 * effectiveTime) / inner_step;
        }

        // Calculate distance step with subtle transient influence
        float dist_step = 0.01 + abs(p.y) / 15.0;
        dist_step *= 1.0 + uTransients * uTransientCameraEffect * 0.002; // Very subtle step size increase on beats
        z += dist_step;

        // Base color contribution
        vec4 color_contribution = (cos(vec4(0.0, 1.0, 2.0, 0.0) - p.y * 2.0) + 1.1) / (z * dist_step);

        // Subtle color modulation based on audio
        vec3 baseColor = mix(uColor1, uColor2, clamp(p.y * 0.1, 0.0, 1.0));
        baseColor = mix(baseColor, uColor3, uHighEnergy * uEnergyColorEffect * 0.05); // Subtle color shift with treble
        baseColor *= 1.0 + uTransients * uTransientColorEffect * 0.02; // Subtle brightness boost on beats
        color_contribution.rgb *= baseColor;

        totalColor += color_contribution;
    }

    // Final tonemapping
    totalColor = tanh(totalColor / 700.0);

    // Subtle fog effect
    float fogStrength = 0.02 + uHighEnergy * uEnergyColorEffect * 0.005; // Subtle fog increase with treble
    float fogAmount = exp(-z * fogStrength);
    totalColor.rgb = mix(uFogColor, totalColor.rgb, fogAmount);

    // Subtle glow effect
    vec3 glow = uGlowColor * (uTransients * uTransientColorEffect * 0.05 + uEnergy * uEnergyColorEffect * 0.02);
    totalColor.rgb += glow;

    // Set final fragment color
    fragColor = vec4(totalColor.rgb, 1.0);
}`;

export default dreamyCubesShaderSource;
