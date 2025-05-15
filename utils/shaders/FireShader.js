const fireShaderSource = `#version 300 es
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
uniform vec3 uColor1;        // First color zone
uniform vec3 uColor2;        // Second color zone
uniform vec3 uColor3;        // Third color zone
uniform vec3 uFogColor;      // Fog color
uniform vec3 uGlowColor;     // Glow color

// Camera speed uniform
uniform float uCameraSpeed;  // Controls movement speed through tunnel

// Output color
out vec4 fragColor;

// Helper function for rotation
mat2 rot(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, s, -s, c);
}

void main() {
    // Normalized texture coordinates for vignette
    vec2 q = gl_FragCoord.xy / uResolution.xy;
    
    // Calculate ray direction based on fragment coordinates
    vec3 rayDirection = normalize(vec3(gl_FragCoord.xy * 2.0 - uResolution.xy, -uResolution.y));

    vec4 totalColor = vec4(0.0); // Accumulator for the color
    float z = 0.0; // Accumulator for distance/depth

    // Main loop: loop from i=1 to i=50
    for (float i = 1.0; i <= 50.0; i++) {
        // Calculate position 'p' based on 'z' and ray direction
        vec3 p = z * rayDirection;

        // Subtle camera movement: low frequencies slightly affect z-position
        float cameraOffset = 5.0 + cos(uTime * uCameraSpeed);
        cameraOffset += uLowEnergy * uEnergyCameraEffect * 0.01; // Extremely subtle bass-driven movement
        p.z += cameraOffset;

        // Apply rotation to p.xz with subtle high-frequency influence
        float angle = uTime + p.y * 0.5;
        angle += uHighEnergy * uEnergyCameraEffect * 0.005; // Subtle rotation tweak on high frequencies
        float scale = max(p.y * 0.1 + 1.0, 0.1);
        p.xz *= rot(angle) / scale;

        // Inner loop: noise deformation
        float j;
        for (j = 2.0; j < 15.0; j /= 0.6) {
            p += cos((p.yzx - vec3(uTime, 0.0, 0.0) / 0.1) * j + uTime) / j;
        }

        // Calculate distance step with subtle transient influence
        float breathingPhase = sin(uTime * uBreathingRate);
        float breathingFactor = 1.0 + uBreathingAmount * breathingPhase * 0.01; // Very subtle breathing
        float transientShrink = 1.0 - uTransients * uTransientIntensity * uTransientCameraEffect * 0.005; // Subtle contraction on beats
        float dist_step = (0.01 + abs(length(p.xz) + p.y * 0.3 - 0.5) / 7.0) * transientShrink * breathingFactor;
        z += dist_step;

        // Color zones based on p.y
        vec3 baseCol = uColor1; // Default color
        if (p.y > 0.5) baseCol = uColor2; // Second color zone
        if (p.y > 1.0) baseCol = uColor3; // Third color zone

        // Subtle color reactivity: transients slightly boost brightness
        vec4 color_contribution = (sin(z / 3.0 + vec4(7.0, 2.0, 3.0, 0.0)) + 1.1) / dist_step;
        color_contribution.rgb *= baseCol;
        color_contribution.rgb *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.01; // Subtle brightness pulse

        // Subtle fog effect, scaled down near edges
        float fogStrength = 0.05 + uHighEnergy * uEnergyCameraEffect * 0.005; // Minimal fog with high-frequency influence
        float fogT = exp(z * fogStrength - 2.0);
        color_contribution.rgb += uFogColor * fogT * 0.02; // Very subtle fog

        totalColor += color_contribution;
    }

    // Final tonemapping
    totalColor = tanh(totalColor / 1000.0);

    // Add subtle glow effect
    vec3 audioReactiveGlow = uGlowColor * (uTransients * uTransientIntensity * uTransientColorEffect * 0.01);
    totalColor.rgb += audioReactiveGlow;

    // Apply vignette to ensure black edges
    float vignette = pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.3);
    totalColor.rgb *= vignette; // Darken edges to black

    // Set final fragment color
    fragColor = vec4(totalColor.rgb, 1.0);
}`;

export default fireShaderSource;