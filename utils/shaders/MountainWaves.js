const mountainWavesShaderSource = `#version 300 es
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

// Effect intensity uniforms
uniform float uTransientIntensity;    // Intensity of transient effects
uniform float uEnergyCameraEffect;    // Energy effect on camera
uniform float uEnergyColorEffect;     // Energy effect on colors
uniform float uTransientCameraEffect; // Transients effect on camera
uniform float uTransientColorEffect;  // Transients effect on colors

// Tunnel breathing effect uniforms
uniform float uBreathingRate;         // Speed of tunnel breathing
uniform float uBreathingAmount;       // Amount of tunnel expansion/contraction

// Color uniforms
uniform vec3 uColor1; // Primary color
uniform vec3 uColor2; // Secondary color
uniform vec3 uColor3; // Tertiary color
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
    // Calculate ray direction with aspect ratio correction
    vec2 p = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
    vec3 rayDirection = normalize(vec3(p, -1.0));

    // Subtle camera movement influenced by audio
    vec3 ro = vec3(0.0, 0.0, uTime * uCameraSpeed);
    // Low frequencies cause slight horizontal drift
    ro.x += sin(uTime * 0.3) * 0.02 * uLowEnergy * uEnergyCameraEffect;
    // High frequencies cause slight vertical drift
    ro.y += cos(uTime * 0.4) * 0.01 * uHighEnergy * uEnergyCameraEffect;
    // Transients cause minor depth jitter
    ro.z += uTransients * uTransientIntensity * uTransientCameraEffect * 0.01;

    // Apply subtle rotation to ray direction based on high frequencies
    float rotAmount = uHighEnergy * uEnergyCameraEffect * 0.02;
    rayDirection.xy *= rot(rotAmount);

    vec4 totalColor = vec4(0.0); // Accumulator for the color
    float z = 0.0; // Accumulator for distance/depth parameter

    // Fog accumulator for subtle depth effect
    float fogT = 0.0;

    // Main raymarching loop
    for (float i = 1.0; i <= 80.0; i++) {
        // Calculate position along ray
        vec3 p = ro + z * rayDirection;

        // Modify p.y with subtle breathing effect
        float breathingPhase = sin(uTime * uBreathingRate);
        float breathingFactor = 1.0 + uBreathingAmount * 0.05 * breathingPhase * (1.0 + uLowEnergy * uEnergyCameraEffect * 0.1);
        p.y = length(cos(p * 0.2 + z * 0.2)) * 4.0 * breathingFactor - abs(p.y);

        // Inner loop for shape deformation
        float inner_step;
        for (inner_step = 1.4; inner_step < 100.0; inner_step /= 0.5) {
            vec3 offset = vec3(3.0, inner_step * uTime, uTime / 3.0);
            p += cos(p.yzx * inner_step - offset) / inner_step;
        }

        // Calculate distance step
        float dist_step = 0.01 + 0.1 * max(p, -p * 0.3).y;
        z += dist_step;

        // Base color contribution
        vec4 color_contribution = (cos(vec4(5.0, 7.0, 9.0, 0.0) - p.y) + 1.1) / (z * dist_step);

        // Subtle color modulation based on audio
        vec3 col = color_contribution.rgb;
        // Select color based on position
        vec3 baseCol = uColor1;
        if (p.y > 0.5) baseCol = uColor2;
        if (p.y > 1.0) baseCol = uColor3;
        col *= baseCol;
        // Transients boost brightness slightly
        col *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.05;
        // Energy enhances saturation subtly
        col *= 1.0 + uEnergy * uEnergyColorEffect * 0.03;
        // High frequencies boost blue channel
        col.b *= 1.0 + uHighEnergy * uEnergyColorEffect * 0.02;

        // Subtle fog effect
        float fogStrength = 0.02 + uHighEnergy * uEnergyCameraEffect * 0.005;
        float fogC = exp(z * fogStrength - 2.0);
        vec3 fog = uFogColor * (1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.05);
        col += fog * clamp(fogC - fogT, 0.0, 1.0) * 0.05;
        fogT = fogC;

        totalColor += vec4(col, color_contribution.a);
    }

    // Final tonemapping
    totalColor = tanh(totalColor / 700.0);

    // Add subtle glow effect
    vec3 glow = uGlowColor * (uTransients * uTransientIntensity * uTransientColorEffect * 0.1 + uEnergy * uEnergyColorEffect * 0.05);
    totalColor.rgb += glow * 0.2;

    // Apply subtle vignette
    vec2 q = gl_FragCoord.xy / uResolution.xy;
    totalColor.rgb *= pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.1) * (0.5 + uEnergy * uEnergyColorEffect * 0.05);

    // Set final fragment color
    fragColor = vec4(totalColor.rgb, 1.0);
}`;

export default mountainWavesShaderSource;