/**
 * RetroTunnelShader.js
 * Exports a retro-style neon tunnel shader for direct use in JavaScript.
 * Enhanced with comprehensive audio reactivity including energy, low/high frequency response.
 */

const retroTunnelShaderSource = `#version 300 es
precision mediump float;
in vec2 vTexCoord;

// Common uniforms
uniform float uTime;
uniform vec2 uResolution;
uniform float uCameraSpeed; // Controls movement speed through tunnel

// Audio analysis uniforms
uniform float uTransients;   // Beat detection
uniform float uEnergy;       // Overall audio energy
uniform float uLowEnergy;    // Low frequency energy
uniform float uHighEnergy;   // High frequency energy

// New uniforms for effect intensity and specific audio component effects
uniform float uTransientIntensity;    // Overall intensity of transient effects (from existing transientEffect slider)
uniform float uEnergyCameraEffect;    // How much energy (overall, low, high) affects camera
uniform float uEnergyColorEffect;     // How much energy (overall, low, high) affects colors
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

out vec4 fragColor; // GLSL ES 3.0 output

// Rotation matrix for 2D
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// 3x3 matrix for noise deformation (simplified from original)
const mat3 m3 = mat3(0.4, 0.6, -0.7, -0.9, 0.3, -0.2, 0.2, 0.7, 0.6) * 1.8;

// Utility functions
float mag2(vec2 p) { return dot(p, p); }
float linstep(float mn, float mx, float x) { return clamp((x - mn) / (mx - mn), 0., 1.); }

// Smooth step function for transitions
float smootherstep(float edge0, float edge1, float x) {
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); // Smootherstep polynomial
}

// Pseudo-random number generator
float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// RGB pseudo-random colors
vec3 randomColor(float seed) {
    return vec3(
        hash21(vec2(seed, 23.14)),
        hash21(vec2(seed, 52.87)),
        hash21(vec2(seed, 117.36))
    );
}

// Global variables
float prm1 = 0.;
vec2 bsMo = vec2(0);

// Displacement for tunnel swirl - with audio reactivity
vec2 disp(float t) { 
    // Camera speed influences tunnel expansion
    float expansion = 1.5 * (1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.10);
    
    // Low frequency influences the tunnel width - bass makes it expand
    expansion *= 1.0 + uLowEnergy * uEnergyCameraEffect * 0.2;
    
    // High frequency influences tunnel asymmetry - creates more dynamic shape
    float asymmetry = uHighEnergy * uEnergyCameraEffect * 0.1;
    
    // Faster camera motion creates more dynamic swirls
    float swirl = uCameraSpeed * 0.15;
    return vec2(
        sin(t * 0.25) * expansion + cos(t * 0.3) * asymmetry,
        cos(t * 0.2) * expansion + sin(t * 0.4) * asymmetry
    );
}

// Noise-based map function with enhanced audio reactivity
vec2 map(vec3 p) {
    vec3 p2 = p;
    p2.xy -= disp(p.z).xy; // Displace for tunnel effect
    
    // Rotation speed influenced by camera speed and high frequency energy
    float rotationSpeed = sin(p.z + uTime) * 0.15 + uTime * 0.1 * min(uCameraSpeed, 2.0);
    rotationSpeed *= 1.0 + uHighEnergy * uEnergyCameraEffect * 0.2; // High frequencies make it rotate faster
    p.xy *= rot(rotationSpeed);
    
    float cl = mag2(p2.xy);
    float d = 0.;
    
    // No scale change for pattern - removed to reduce jerkiness
    float z = 1.;
    float trk = 1.;
    
    // Amplitude boost controlled by transients and energy
    float dspAmp = 0.15 * (1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.10 + uEnergy * uEnergyCameraEffect * 0.05);
    
    // Fewer iterations for simpler, retro-style noise
    for (int i = 0; i < 2; i++) {
        // Make the noise pattern react to audio
        float noiseScale = 0.8 * (1.0 + uEnergy * uEnergyCameraEffect * 0.05);
        p += sin(p.zxy * noiseScale * trk + uTime * trk * 0.7) * dspAmp;
        d -= abs(dot(cos(p), sin(p.yzx)) * z);
        z *= 0.6;
        trk *= 1.5;
        p = p * m3;
    }
    
    // Combined transient and low frequency effect for tunnel shape
    float audioShrink = 1.0 - (uTransients * uTransientIntensity * uTransientCameraEffect * 0.10 + uLowEnergy * uEnergyCameraEffect * 0.05);
    
    // NEW: Add breathing effect to the tunnel hole size
    // Create a slow oscillation for the tunnel hole size based on time
    // Using uniform variables instead of hardcoded values
    float breathingPhase = sin(uTime * uBreathingRate);
    float breathingFactor = 1.0 + uBreathingAmount * (50.0 + 50.0 * breathingPhase);
    
    d = abs(d + prm1 * 2.) + prm1 * 0.2 - 2. + bsMo.y;
    
    // Apply both audio reactivity and breathing effect to the tunnel size
    d *= audioShrink * breathingFactor;
    
    return vec2(d + cl * 0.15 + 0.3, cl);
}

// Render function with enhanced audio reactivity
vec4 render(vec3 ro, vec3 rd, float time) {
    vec4 rez = vec4(0);
    const float ldst = 6.;
    vec3 lpos = vec3(disp(time + ldst) * 0.4, time + ldst);
    float t = 1.;
    float fogT = 0.;
    
    // Tunnel speed variation with combined audio inputs
    float tunnelSpeedFactor = 1.0 + uTransients * uTransientIntensity * uTransientCameraEffect * 0.10 + uEnergy * uEnergyCameraEffect * 0.05;
    
    // Motion blur effect increases with speed and high frequencies
    float motionBlurFactor = 0.0; // clamp((uCameraSpeed - 1.0) * 0.2, 0.0, 0.5) * (1.0 + uHighEnergy * uEnergyCameraEffect * 0.1); // Set to 0 to remove motion blur
    
    for (int i = 0; i < 1000; i++) {
        if (rez.a > 0.99) break;
        
        vec3 pos = ro + t * rd * tunnelSpeedFactor; // Speed-adjusted ray position
        vec2 mpv = map(pos);
        float den = clamp(mpv.x - 0.4, 0., 1.) * 1.2;
        float dn = clamp((mpv.x + 1.5), 0., 2.5);

        vec4 col = vec4(0);
        if (mpv.x > 0.5) {
            // Use our randomly generated colors based on position in tunnel
            vec3 baseCol = uColor1; // Default color
            if (mpv.y > 0.5) baseCol = uColor2; // Second color zone
            if (mpv.y > 1.0) baseCol = uColor3; // Third color zone
            
            // Enhanced color reactivity using all audio parameters
            if (uTransients * uTransientIntensity > 0.1) {
                // Transients boost brightness
                baseCol *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.3;
            }
            
            if (uLowEnergy * uEnergyColorEffect > 0.6) {
                // Strong bass shifts colors toward red/warm
                baseCol.r *= 1.0 + (uLowEnergy * uEnergyColorEffect - 0.6) * 0.5;
            }
            
            if (uHighEnergy * uEnergyColorEffect > 0.6) {
                // High frequencies enhance blues/cyans
                baseCol.b *= 1.0 + (uHighEnergy * uEnergyColorEffect - 0.6) * 0.5;
            }
            
            // Color pulsing influenced by overall energy
            float pulseFactor = 0.5 + 0.5 * sin(pos.z * 0.3 + uTime);
            pulseFactor = mix(pulseFactor, 0.5 + 0.5 * sin(pos.z * 0.3 + uTime * 2.0), uEnergy * uEnergyColorEffect * 0.3);
            col = vec4(baseCol * pulseFactor, 0.1);
            
            col *= den * den;
            col.rgb *= linstep(3.5, -2., mpv.x) * 2.0;
            float dif = clamp(den / 8., 0.001, 1.);
            col.xyz *= den * (vec3(0.01, 0.05, 0.08) + 1.2 * vec3(0.05, 0.1, 0.05) * dif);
            
            // Combined audio reactivity for brightness
            col.rgb *= 1.0 + uTransients * uTransientIntensity * uTransientColorEffect * 0.3 + uLowEnergy * uEnergyColorEffect * 0.1 + uHighEnergy * uEnergyColorEffect * 0.1;
            
            // Add subtle glow with speed and energy
            col.rgb *= 1.0 + clamp(uCameraSpeed - 1.0, 0.0, 1.0) * 0.115 * (1.0 + uEnergy * uEnergyCameraEffect * 0.1);
        }

        // Fog influenced by audio
        float baseFogStrength = 0.15 + motionBlurFactor;
        float audioFogStrength = uHighEnergy * uEnergyCameraEffect * 0.05;
        float fogStrength = (baseFogStrength + audioFogStrength) / 5.0; // Reduced fog strength
        float fogC = exp(t * fogStrength - 2.);
        
        // Dynamic fog color
        vec4 fogColor = vec4(uFogColor, 0.08);
        // Brighter fog during audio events
        vec4 activeFogColor = vec4(
            mix(uFogColor, uFogColor * 1.5, uTransients * uTransientIntensity * uTransientColorEffect),
            0.08 + uEnergy * uEnergyColorEffect * 0.02 // Stronger fog effect with higher energy
        );
        
        // Apply audio reactivity to fog
        fogColor = mix(
            fogColor, 
            activeFogColor, 
            uTransients * uTransientIntensity * uTransientColorEffect * 0.6 + uLowEnergy * uEnergyColorEffect * 0.2 + uHighEnergy * uEnergyColorEffect * 0.2
        );
        
        col.rgba += fogColor * clamp(fogC - fogT, 0., 1.); // Re-enabled fog application
        fogT = fogC;
        rez = rez + col * (1. - rez.a);
        
        // Step size influenced by camera speed and energy
        float speedAdjustedStep = clamp(0.4 - dn * dn * 0.06, 0.1, 0.35) * 
                                 (1.0 + motionBlurFactor) * 
                                 (1.0 + uEnergy * uEnergyCameraEffect * 0.05); // Overall energy makes rays go further
        t += speedAdjustedStep;
    }
    return clamp(rez, 0., 1.);
}

// Saturation for color lerp
float getsat(vec3 c) {
    float mi = min(min(c.x, c.y), c.z);
    float ma = max(max(c.x, c.y), c.z);
    return (ma - mi) / (ma + 1e-7);
}

// Simplified color lerp for retro look
vec3 iLerp(vec3 a, vec3 b, float x) {
    return mix(a, b, x);
}

void main() {
    vec2 q = vTexCoord;
    vec2 p = (vTexCoord * 2.0 - 1.0);
    p.x *= uResolution.x / uResolution.y; // Aspect ratio correction
    
    // Camera movement influenced by audio
    bsMo = vec2(0.0, 0.0);
    // Low frequencies create subtle horizontal shifts
    bsMo.x += sin(uTime * 0.3) * 0.1 * (1.0 + uLowEnergy * uEnergyCameraEffect * 0.1);
    // High frequencies create subtle vertical shifts
    bsMo.y += cos(uTime * 0.4) * 0.05 * uHighEnergy * uEnergyCameraEffect;
    
    // Time flow affected by energy
    float timeScale = 1.0 + uEnergy * uEnergyCameraEffect * 0.1;
    float time = uTime * uCameraSpeed * timeScale; // Modified to use energy and camera speed
    
    // Position with audio-reactive movement
    vec3 ro = vec3(0, 0, time);
    
    // Displacement amplitude influenced by low frequency
    float dspAmp = 0.9 * (1.0 + uLowEnergy * uEnergyCameraEffect * 0.1);
    ro.xy += disp(ro.z) * dspAmp;
    
    float tgtDst = 3.;
    vec3 target = normalize(ro - vec3(disp(time + tgtDst) * dspAmp, time + tgtDst));
    ro.x -= bsMo.x * 1.5;
    ro.y -= bsMo.y * 1.5;
    
    // Standard camera direction calculation
    vec3 rightdir = normalize(cross(target, vec3(0, 1, 0)));
    vec3 updir = normalize(cross(rightdir, target));
    rightdir = normalize(cross(updir, target));
    vec3 rd = normalize((p.x * rightdir + p.y * updir) * 1.0 - target);
    
    // Rotation influenced by camera speed and high frequencies
    float rotAmount = -disp(time + 3.).x * 0.15 + bsMo.x;
    rotAmount *= mix(1.0, 1.5, clamp(uCameraSpeed - 1.0, 0.0, 1.0) * (1.0 + uHighEnergy * uEnergyCameraEffect * 0.2));
    rd.xy *= rot(rotAmount);
    
    // Parameter modulation with audio variance
    prm1 = smoothstep(-0.5, 0.5, sin(uTime * 0.4 * (1.0 + uEnergy * uEnergyCameraEffect * 0.1)));
    vec4 scn = render(ro, rd, time);
    
    vec3 col = scn.rgb;
    // Color mixing based on parameter and high frequency influence
    float colorMix = clamp(1. - prm1, 0.1, 1.);
    colorMix = mix(colorMix, 1.0 - colorMix, uHighEnergy * uEnergyColorEffect * 0.2); // High frequencies can invert the effect
    col = iLerp(col.bgr, col.rgb, colorMix);
    
    // Retro post-processing with subtle audio enhancement
    col = pow(col, vec3(0.6, 0.7, 0.65) * (1.0 - uLowEnergy * uEnergyColorEffect * 0.05)) * vec3(1., 0.95, 0.9);
    
    // Vignette strength affected by energy
    float vignetteStrength = 0.6 + uEnergy * uEnergyColorEffect * 0.1;
    // col *= pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.2) * vignetteStrength + 0.4; // Vignette commented out
    
    // Scanlines affected by high frequencies
    float scanlineIntensity = 0.1 * (1.0 + uHighEnergy * uEnergyColorEffect * 0.2);
    float scanlineStrength = 0.9 + scanlineIntensity * sin(vTexCoord.y * 50.0 + uTime * 0.5);
    // col *= scanlineStrength; // Scanlines commented out
    
    // Glow effects enhanced by audio
    vec3 audioReactiveGlow = uGlowColor * (uTransients * uTransientIntensity * uTransientColorEffect * 0.8 + uLowEnergy * uEnergyColorEffect * 0.3 + uHighEnergy * uEnergyColorEffect * 0.5);
    col += audioReactiveGlow * 2.0; // Increased glow
    
    // Final color output with subtle energy-based saturation boost
    fragColor = vec4(col * (1.0 + uEnergy * uEnergyColorEffect * 0.05), 1.0);
}
`;

export default retroTunnelShaderSource;
