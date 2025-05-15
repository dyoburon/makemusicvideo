const greenFractalsShaderSource = `#version 300 es
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
uniform vec3 uColor1;                 // Primary color
uniform vec3 uColor2;                 // Secondary color
uniform vec3 uColor3;                 // Tertiary color
uniform vec3 uFogColor;               // Fog color
uniform vec3 uGlowColor;              // Glow color

// Output color
out vec4 fragColor;

// Helper function for rotation (kept for consistency, though not used)
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

    // Subtle camera offset influenced by low frequencies and transients
    float cameraOffset = uLowEnergy * uEnergyCameraEffect * 0.005 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.002;
    float time = uTime * uCameraSpeed + cameraOffset; // Apply camera speed and subtle audio drift

    // Breathing effect for distance field
    float breathingPhase = sin(time * uBreathingRate);
    float breathingFactor = 1.0 + uBreathingAmount * breathingPhase * 0.01; // Very subtle breathing

    // Main loop: runs 50 iterations
    for (float i = 1.0; i <= 50.0; i++) {
        // Calculate position with time offset
        vec3 p = z * rayDirection;
        p.z -= time;

        // Inner loop for distance field
        float d = 1.0; // Distance accumulator
        for (float f = 1.0; f < 100.0; f += f) {
            vec3 s = sin(p * f + vec3(f, -f, 0.0));
            d = min(d, dot(s, s.yzx) / f);
        }

        // Subtle distance modulation with transients and breathing
        d = (0.004 + 0.5 * abs(d)) * breathingFactor * (1.0 - uTransients * uTransientIntensity * 0.002);

        // Update z
        z += d;

        // Color contribution with subtle audio reactivity
        vec4 colorContribution = exp(-z / vec4(2.0, 9.0, 4.0, 9.0)) / d;
        // Apply subtle color modulation based on energy and high frequencies
        vec3 colorMod = uColor1 * (1.0 + uEnergy * uEnergyColorEffect * 0.005 + uHighEnergy * uEnergyColorEffect * 0.003);
        colorContribution.rgb *= colorMod;
        // Add faint glow based on transients
        colorContribution.rgb += uGlowColor * uTransients * uTransientIntensity * uTransientColorEffect * 0.002;

        totalColor += colorContribution;
    }

    // Final tonemapping
    totalColor = tanh(totalColor / 1000.0);

    // Add subtle fog effect influenced by audio
    vec3 fog = uFogColor * (0.01 + uEnergy * uEnergyColorEffect * 0.002);
    totalColor.rgb += fog;

    // Set final fragment color
    fragColor = vec4(totalColor.rgb, 1.0);
}
`;

export default greenFractalsShaderSource;
