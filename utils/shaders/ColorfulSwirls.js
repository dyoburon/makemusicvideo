const colorfulSwirlsShaderSource = `#version 300 es
precision highp float;

// Standard uniforms
uniform vec2 uResolution;
uniform float uTime;
uniform float uCameraSpeed; // Controls movement speed through tunnel

// Audio analysis uniforms
uniform float uTransients;   // Beat detection
uniform float uEnergy;       // Overall audio energy
uniform float uLowEnergy;    // Low frequency energy
uniform float uHighEnergy;   // High frequency energy

// Effect intensity and specific audio component effects
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

// Output color
out vec4 fragColor;

// Helper function for rotation
mat2 rot(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, s, -s, c);
}

// Smooth step function for transitions
float smootherstep(float edge0, float edge1, float x) {
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

void main() {
    // Normalize fragment coordinates to [-1, 1] with aspect ratio correction
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
    vec3 rayDirection = normalize(vec3(uv, -1.0));

    // Subtle camera offset based on audio (extremely small effect)
    vec2 cameraOffset = vec2(0.0);
    cameraOffset.x += uLowEnergy * uEnergyCameraEffect * 0.01; // Low freq subtle horizontal shift
    cameraOffset.y += uHighEnergy * uEnergyCameraEffect * 0.005; // High freq subtle vertical shift
    cameraOffset += uTransients * uTransientIntensity * uTransientCameraEffect * 0.005; // Transient micro-shake
    rayDirection.xy += cameraOffset;

    vec4 totalColor = vec4(0.0);
    float z = 0.0;

    // Subtle breathing effect for distance scaling
    float breathingPhase = sin(uTime * uBreathingRate);
    float breathingFactor = 1.0 + uBreathingAmount * (0.01 + 0.01 * breathingPhase) * (1.0 + uEnergy * uEnergyCameraEffect * 0.01);

    // Main raymarching loop
    for (float i = 1.0; i <= 100.0; i++) {
        vec3 p = z * rayDirection;
        p.z -= uTime * uCameraSpeed; // Apply camera speed

        // Inner fractal/deformation loop
        float inner_step;
        for (inner_step = 1.0; inner_step < 9.0; inner_step /= 0.7) {
            // Subtle audio-driven deformation
            float deformScale = 1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.005;
            p += cos(p.yzx * inner_step + z * 0.2 - uTime * 0.1) / inner_step * deformScale;
        }

        // Distance step with subtle breathing effect
        float dist_step = 0.02 + 0.1 * abs(p.y + 1.0);
        dist_step *= breathingFactor; // Apply breathing
        z += dist_step;

        // Color contribution with custom palette
        float colorPhase = z + uTime;
        vec3 baseColor = mix(uColor1, uColor2, smootherstep(0.0, 1.0, sin(colorPhase * 0.5)));
        baseColor = mix(baseColor, uColor3, smootherstep(0.0, 1.0, sin(colorPhase * 0.3 + 1.0)));

        // Subtle audio color modulation
        baseColor += uLowEnergy * uEnergyColorEffect * 0.01 * vec3(0.2, 0.0, 0.0); // Warm tint for bass
        baseColor += uHighEnergy * uEnergyColorEffect * 0.01 * vec3(0.0, 0.0, 0.2); // Cool tint for highs
        baseColor *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.02; // Transient brightness

        vec4 color_contribution = vec4(baseColor, 1.0) / dist_step;
        totalColor += color_contribution;
    }

    // Tonemapping
    totalColor = tanh(totalColor / 2000.0);

    // Subtle fog effect
    float fogStrength = 0.01 + uEnergy * uEnergyCameraEffect * 0.005;
    float fogAmount = exp(-z * fogStrength);
    vec3 finalColor = mix(uFogColor, totalColor.rgb, fogAmount);

    // Subtle glow effect
    finalColor += uGlowColor * (uTransients * uTransientIntensity * uTransientColorEffect * 0.02 +
                               uEnergy * uEnergyColorEffect * 0.01);

    fragColor = vec4(finalColor, 1.0);
}
`;

export default colorfulSwirlsShaderSource;
