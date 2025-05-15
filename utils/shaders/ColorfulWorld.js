const colorWorldShaderSource = `#version 300 es
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

void main() {
    // Calculate ray direction with aspect ratio correction
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = (uv * 2.0 - 1.0);
    p.x *= uResolution.x / uResolution.y;
    vec3 rayDirection = normalize(vec3(p, -1.0));

    vec4 totalColor = vec4(0.0); // Accumulator for the color
    float z = 0.0; // Accumulator for distance/depth parameter

    // Subtle audio-driven camera offset
    float time = uTime * uCameraSpeed;
    vec3 cameraOffset = vec3(
        uLowEnergy * uEnergyCameraEffect * 0.01, // Tiny horizontal shift
        uHighEnergy * uEnergyCameraEffect * 0.01, // Tiny vertical shift
        0.0
    );

    // Breathing effect for subtle tunnel scaling
    float breathingPhase = sin(time * uBreathingRate);
    float breathingFactor = 1.0 + uBreathingAmount * 0.01 * breathingPhase; // Very subtle

    // Main loop
    for (float i = 1.0; i <= 80.0; i++) {
        // Calculate position with audio offset
        vec3 pos = z * rayDirection + cameraOffset * 0.01; // Extremely subtle offset

        // Apply breathing effect to position scaling
        pos *= breathingFactor;

        // Shift z slightly with time and transients
        pos.z += 0.1 + uTransients * uTransientCameraEffect * 0.005; // Very subtle

        // Calculate l and scale pos
        float l = dot(pos, pos);
        pos /= l;

        // Calculate distance step with subtle transient influence
        float d = sqrt(l) / 80.0 * length(cos(pos + cos(pos / 0.27 + time)) + 0.8);
        d *= 1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.005; // Subtle scaling
        z += d;

        // Color contribution with subtle audio modulation
        vec3 baseColor = cos(log(l) * 3.0 - time + vec3(0.0, 1.0, 2.0)) + 1.0;
        
        // Blend between uColor1, uColor2, uColor3 based on position and audio
        float colorMix = clamp(log(l) * 0.5 + uEnergy * uEnergyColorEffect * 0.01, 0.0, 1.0);
        vec3 mixedColor = mix(
            mix(uColor1, uColor2, colorMix),
            uColor3,
            uHighEnergy * uEnergyColorEffect * 0.01
        );
        
        // Apply subtle transient brightness boost
        mixedColor *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.01;
        
        // Combine base color with mixed color
        vec4 colorContribution = vec4(mixedColor * baseColor, 1.0) / d;
        totalColor += colorContribution;
    }

    // Apply subtle fog and glow
    vec3 fog = uFogColor * (0.05 + uEnergy * uEnergyColorEffect * 0.005);
    vec3 glow = uGlowColor * uTransients * uTransientIntensity * uTransientColorEffect * 0.01;
    totalColor.rgb += fog + glow;

    // Final tonemapping
    totalColor = tanh(totalColor / 200000.0);

    // Set final fragment color
    fragColor = vec4(totalColor.rgb, 1.0);
}
`;

export default colorWorldShaderSource;