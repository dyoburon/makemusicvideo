precision mediump float;
varying vec2 vTexCoord;

// Time and resolution uniforms
uniform float uTime;
uniform vec2 uResolution;

// Audio feature uniforms
uniform float uEnergy;      // Overall audio energy
uniform float uLowEnergy;   // Bass/low frequency energy
uniform float uHighEnergy;  // Treble/high frequency energy
uniform float uTransients;  // Sudden audio events (beats, etc)

// Constants
#define PI 3.1415926535
#define TWO_PI 6.2831853071

// Function to create smooth circular gradient
float circle(vec2 uv, vec2 pos, float rad, float feather) {
  float dist = length(uv - pos);
  return smoothstep(rad, rad + feather, dist);
}

// Audio reactive rotation matrix
mat2 rotate2D(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  // Normalize coordinates to center (range from -1 to 1)
  vec2 uv = vTexCoord * 2.0 - 1.0;
  
  // Create aspect-corrected UV coordinates
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;
  
  // Audio-reactive variables
  float pulse = 0.5 + 0.5 * sin(uTime * 2.0 + uv.x * uv.y);
  pulse = mix(0.5, pulse, uEnergy); // Modulate pulse with audio energy
  
  // Rotate UVs based on low frequency content
  float rotAmount = uTime * 0.2 + uLowEnergy * 0.5;
  uv *= rotate2D(rotAmount);
  
  // Create base color pattern
  vec3 color = vec3(0.0);
  
  // Generate multiple circles with audio-reactive sizes
  for (int i = 0; i < 3; i++) {
    float index = float(i) / 3.0;
    float speed = 0.4 + index * 0.3;
    
    // Circles position modulated by time and audio
    vec2 pos = vec2(
      sin(uTime * speed + index * PI * 2.0) * 0.5,
      cos(uTime * speed + index * PI * 2.0) * 0.5
    );
    
    // Adjust circle size with audio transients and low energy
    float size = 0.2 + index * 0.1;
    size *= 1.0 + uTransients * 0.5 + uLowEnergy * 0.3;
    
    // Draw circle with soft edges
    float circ = 1.0 - circle(uv, pos, size, 0.1);
    
    // Color each circle differently
    vec3 circleColor = 0.5 + 0.5 * cos(uTime * 0.2 + index * TWO_PI/3.0 + vec3(0, 2, 4));
    circleColor = mix(circleColor, vec3(1.0), uHighEnergy * 0.3); // Add brightness from high freq
    
    // Add to final color
    color += circ * circleColor * (0.7 + pulse * 0.3);
  }
  
  // Add dynamic background with audio reactivity
  vec3 bgColor = vec3(0.05, 0.03, 0.1) + uLowEnergy * vec3(0.05, 0.0, 0.1);
  color = mix(bgColor, color, color);
  
  // Add glimmer effects on high energy
  if (uHighEnergy > 0.7) {
    float glimmer = fract(sin(uv.x * 100.0 + uv.y * 100.0 + uTime * 10.0) * 5000.0);
    glimmer = smoothstep(0.9, 1.0, glimmer);
    color += glimmer * uHighEnergy * vec3(0.7, 0.8, 1.0);
  }
  
  // Add ripple effect on transients
  if (uTransients > 0.1) {
    float ring = sin(length(uv) * 20.0 - uTime * 10.0 * uTransients);
    ring = smoothstep(0.9, 1.0, ring);
    color += ring * uTransients * vec3(1.0, 0.8, 0.6) * 0.3;
  }
  
  // Final color adjustment
  color = pow(color, vec3(0.8)); // Gamma correction
  
  gl_FragColor = vec4(color, 1.0);
} 