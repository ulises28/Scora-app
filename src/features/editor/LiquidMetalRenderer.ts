/**
 * Required Notice: Copyright Lost Coast Labs, Inc. (http://paper.design)
 * Modified for Scora App WebGL integration.
 */

// --- 1. GLSL Utilities ---

const declarePI = `
#define PI 3.14159265359
`;

const rotation2 = `
vec2 rotate(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    mat2 m = mat2(c, -s, s, c);
    return m * v;
}
`;

const simplexNoise = `
// Simplex 2D noise
// https://github.com/stegu/webgl-noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

const colorBandingFix = `
// Basic dithering to reduce banding
color += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453) - 0.5) / 255.0;
`;

// --- 2. Shader Source ---

export const liquidMetalFragmentShader = `#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform float u_time;
uniform vec2 u_resolution;
uniform bool u_isImage;

in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;
  vec2 texUV = vec2(uv.x, 1.0 - uv.y);
  
  vec4 img = texture(u_image, texUV);
  float opacity = img.g;
  
  if (u_isImage && opacity > 0.01) {
    // 1. Calculate Normals from the Height Map (img.r)
    vec2 texel = 1.0 / u_resolution;
    
    // Sample neighbors to get gradient
    float hL = texture(u_image, texUV - vec2(texel.x, 0.0)).r;
    float hR = texture(u_image, texUV + vec2(texel.x, 0.0)).r;
    float hD = texture(u_image, texUV - vec2(0.0, texel.y)).r;
    float hU = texture(u_image, texUV + vec2(0.0, texel.y)).r;
    
    // Smooth the normals slightly for liquid look
    float dX = (hL - hR) * 1.5;
    float dY = (hD - hU) * 1.5;
    
    // Z controls how "inflated" or flat the normal is
    vec3 N = normalize(vec3(dX, dY, 0.08));
    
    // 2. Setup Camera and Reflections
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 ref = reflect(-viewDir, N);
    
    // 3. MatCap (Material Capture) mapping for Chrome Studio Lighting
    float m = 2.0 * sqrt(ref.x*ref.x + ref.y*ref.y + (ref.z+1.0)*(ref.z+1.0));
    vec2 matcapUV = ref.xy / m + 0.5;
    
    // Create horizontal studio lights
    float light = smoothstep(0.4, 0.55, matcapUV.y) - smoothstep(0.55, 0.7, matcapUV.y); // Main bright band
    light += (smoothstep(0.1, 0.2, matcapUV.y) - smoothstep(0.2, 0.3, matcapUV.y)) * 0.5; // Secondary band
    light += smoothstep(0.8, 0.9, matcapUV.y) * 0.8; // Top edge light
    light += smoothstep(0.3, 0.1, matcapUV.y) * 0.3; // Bottom rim light
    
    // Base metal colors (dark steel to pure white)
    vec3 color = mix(vec3(0.1, 0.12, 0.15), vec3(1.0, 1.0, 1.0), light);
    
    // Add subtle iridescent/chromatic tint to the edges based on normals
    float fresnel = 1.0 - max(dot(N, viewDir), 0.0);
    color += vec3(0.2, 0.5, 1.0) * pow(fresnel, 3.0) * 0.3; // Blueish rim
    
    // 4. Strong Specular Highlight (The "Gloss")
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float spec = pow(max(dot(N, lightDir), 0.0), 30.0);
    color += vec3(1.0) * spec;
    
    // Output
    fragColor = vec4(color, opacity);
  } else {
    fragColor = vec4(0.0);
  }
}`;;

// --- 3. Poisson Solver Implementation ---

export const POISSON_CONFIG_OPTIMIZED = {
  measurePerformance: false,
  workingSize: 512,
  iterations: 40,
};

interface SparsePixelData {
  interiorPixels: Uint32Array;
  boundaryPixels: Uint32Array;
  pixelCount: number;
  neighborIndices: Int32Array;
}

export function toProcessedLiquidMetal(file: File | string): Promise<{ imageData: ImageData; pngBlob: Blob }> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  return new Promise((resolve, reject) => {
    if (!ctx) return reject(new Error('Invalid canvas context'));

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let originalWidth = img.width || img.naturalWidth;
      let originalHeight = img.height || img.naturalHeight;

      const minDimension = Math.min(originalWidth, originalHeight);
      const targetSize = POISSON_CONFIG_OPTIMIZED.workingSize;
      const scaleFactor = targetSize / minDimension;
      const width = Math.round(originalWidth * scaleFactor);
      const height = Math.round(originalHeight * scaleFactor);

      canvas.width = originalWidth;
      canvas.height = originalHeight;

      const shapeCanvas = document.createElement('canvas');
      shapeCanvas.width = width;
      shapeCanvas.height = height;
      const shapeCtx = shapeCanvas.getContext('2d')!;
      shapeCtx.drawImage(img, 0, 0, width, height);

      const shapeImageData = shapeCtx.getImageData(0, 0, width, height);
      const data = shapeImageData.data;

      const shapeMask = new Uint8Array(width * height);
      const boundaryMask = new Uint8Array(width * height);

      const boundaryIndices: number[] = [];
      const interiorIndices: number[] = [];

      for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
        shapeMask[idx] = data[i + 3] === 0 ? 0 : 1;
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (!shapeMask[idx]) continue;

          let isBoundary = false;
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            isBoundary = true;
          } else {
            isBoundary =
              !shapeMask[idx - 1] || !shapeMask[idx + 1] ||
              !shapeMask[idx - width] || !shapeMask[idx + width] ||
              !shapeMask[idx - width - 1] || !shapeMask[idx - width + 1] ||
              !shapeMask[idx + width - 1] || !shapeMask[idx + width + 1];
          }

          if (isBoundary) {
            boundaryMask[idx] = 1;
            boundaryIndices.push(idx);
          } else {
            interiorIndices.push(idx);
          }
        }
      }

      const sparseData = buildSparseData(
        shapeMask, boundaryMask,
        new Uint32Array(interiorIndices),
        new Uint32Array(boundaryIndices),
        width, height
      );

      const u = solvePoissonSparse(sparseData, shapeMask, boundaryMask, width, height);

      let maxVal = 0;
      for (let i = 0; i < interiorIndices.length; i++) {
        const idx = interiorIndices[i]!;
        if (u[idx]! > maxVal) maxVal = u[idx]!;
      }

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d')!;
      const tempImg = tempCtx.createImageData(width, height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const px = idx * 4;
          if (!shapeMask[idx]) {
            tempImg.data[px] = 255; tempImg.data[px + 1] = 255; tempImg.data[px + 2] = 255; tempImg.data[px + 3] = 0;
          } else {
            const poissonRatio = maxVal > 0 ? u[idx]! / maxVal : 0;
            const gray = 255 * poissonRatio; // Red channel is 255 at the core, 0 at the boundary edge
            tempImg.data[px] = gray; tempImg.data[px + 1] = gray; tempImg.data[px + 2] = gray; tempImg.data[px + 3] = 255;
          }
        }
      }
      tempCtx.putImageData(tempImg, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, originalWidth, originalHeight);

      const outImg = ctx.getImageData(0, 0, originalWidth, originalHeight);
      
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = originalWidth;
      originalCanvas.height = originalHeight;
      const originalCtx = originalCanvas.getContext('2d')!;
      originalCtx.drawImage(img, 0, 0, originalWidth, originalHeight);
      const originalData = originalCtx.getImageData(0, 0, originalWidth, originalHeight);

      for (let i = 0; i < outImg.data.length; i += 4) {
        const a = originalData.data[i + 3]!;
        const upscaledAlpha = outImg.data[i + 3]!;
        if (a === 0) {
          outImg.data[i] = 255; outImg.data[i + 1] = 0;
        } else {
          outImg.data[i] = upscaledAlpha === 0 ? 0 : outImg.data[i]!;
          outImg.data[i + 1] = a; 
        }
        outImg.data[i + 2] = 255; outImg.data[i + 3] = 255;
      }

      ctx.putImageData(outImg, 0, 0);
      
      canvas.toBlob((blob) => {
        resolve({ imageData: outImg, pngBlob: blob! });
      }, 'image/png');
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = typeof file === 'string' ? file : URL.createObjectURL(file);
  });
}

function buildSparseData(shapeMask: Uint8Array, boundaryMask: Uint8Array, interiorPixels: Uint32Array, boundaryPixels: Uint32Array, width: number, height: number): SparsePixelData {
  const pixelCount = interiorPixels.length;
  const neighborIndices = new Int32Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    const idx = interiorPixels[i]!;
    const x = idx % width;
    const y = Math.floor(idx / width);
    neighborIndices[i * 4 + 0] = x < width - 1 && shapeMask[idx + 1] ? idx + 1 : -1;
    neighborIndices[i * 4 + 1] = x > 0 && shapeMask[idx - 1] ? idx - 1 : -1;
    neighborIndices[i * 4 + 2] = y > 0 && shapeMask[idx - width] ? idx - width : -1;
    neighborIndices[i * 4 + 3] = y < height - 1 && shapeMask[idx + width] ? idx + width : -1;
  }
  return { interiorPixels, boundaryPixels, pixelCount, neighborIndices };
}

function solvePoissonSparse(sparseData: SparsePixelData, shapeMask: Uint8Array, boundaryMask: Uint8Array, width: number, height: number): Float32Array {
  const ITERATIONS = POISSON_CONFIG_OPTIMIZED.iterations;
  const C = 0.01;
  const u = new Float32Array(width * height);
  const { interiorPixels, neighborIndices, pixelCount } = sparseData;
  const omega = 1.9;

  const redPixels: number[] = [];
  const blackPixels: number[] = [];

  for (let i = 0; i < pixelCount; i++) {
    const idx = interiorPixels[i]!;
    const x = idx % width;
    const y = Math.floor(idx / width);
    if ((x + y) % 2 === 0) redPixels.push(i);
    else blackPixels.push(i);
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const i of redPixels) {
      const idx = interiorPixels[i]!;
      const eastIdx = neighborIndices[i * 4 + 0]!;
      const westIdx = neighborIndices[i * 4 + 1]!;
      const northIdx = neighborIndices[i * 4 + 2]!;
      const southIdx = neighborIndices[i * 4 + 3]!;
      let sumN = 0;
      if (eastIdx >= 0) sumN += u[eastIdx]!;
      if (westIdx >= 0) sumN += u[westIdx]!;
      if (northIdx >= 0) sumN += u[northIdx]!;
      if (southIdx >= 0) sumN += u[southIdx]!;
      const newValue = (C + sumN) / 4;
      u[idx] = omega * newValue + (1 - omega) * u[idx]!;
    }
    for (const i of blackPixels) {
      const idx = interiorPixels[i]!;
      const eastIdx = neighborIndices[i * 4 + 0]!;
      const westIdx = neighborIndices[i * 4 + 1]!;
      const northIdx = neighborIndices[i * 4 + 2]!;
      const southIdx = neighborIndices[i * 4 + 3]!;
      let sumN = 0;
      if (eastIdx >= 0) sumN += u[eastIdx]!;
      if (westIdx >= 0) sumN += u[westIdx]!;
      if (northIdx >= 0) sumN += u[northIdx]!;
      if (southIdx >= 0) sumN += u[southIdx]!;
      const newValue = (C + sumN) / 4;
      u[idx] = omega * newValue + (1 - omega) * u[idx]!;
    }
  }
  return u;
}

// --- 4. WebGL Render Wrapper ---

const vertexShaderSource = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) / 2.0; // 0 to 1
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error: " + log);
  }
  return shader;
}

export async function applyLiquidMetalEffect(sourceDataURL: string, width: number, height: number): Promise<HTMLCanvasElement> {
  // 1. Calculate Poisson distance field
  const { imageData } = await toProcessedLiquidMetal(sourceDataURL);
  
  // 2. Setup WebGL
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false });
  if (!gl) throw new Error("WebGL2 not supported");

  const vShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)!;
  const fShader = createShader(gl, gl.FRAGMENT_SHADER, liquidMetalFragmentShader)!;

  const program = gl.createProgram()!;
  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    throw new Error("Failed to link shader");
  }

  gl.useProgram(program);

  // 3. Setup Geometry (Full screen quad)
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
    -1.0,  1.0,
     1.0, -1.0,
     1.0,  1.0,
  ]), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // 4. Setup Texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // WebGL2 supports ImageData directly
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // 5. Set Uniforms
  gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);
  gl.uniform1f(gl.getUniformLocation(program, "u_imageAspectRatio"), width / height);
  gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), width, height);
  gl.uniform1f(gl.getUniformLocation(program, "u_time"), performance.now() / 1000);
  
  gl.uniform4f(gl.getUniformLocation(program, "u_colorBack"), 0, 0, 0, 0); // Transparent background
  gl.uniform4f(gl.getUniformLocation(program, "u_colorTint"), 1, 1, 1, 0); // No tint
  
  // Tweak these values for the perfect "Liquid Chrome" look
  gl.uniform1f(gl.getUniformLocation(program, "u_softness"), 1.2); // Smoother gradients
  gl.uniform1f(gl.getUniformLocation(program, "u_repetition"), 4.0); // More bands to show 3D volume
  gl.uniform1f(gl.getUniformLocation(program, "u_shiftRed"), 0.5); // Subtle pearlescent look
  gl.uniform1f(gl.getUniformLocation(program, "u_shiftBlue"), -0.2); // Subtle pearlescent look
  gl.uniform1f(gl.getUniformLocation(program, "u_distortion"), 0.05); // Clean, smooth metal (almost no noise)
  gl.uniform1f(gl.getUniformLocation(program, "u_contour"), 1.5); // Higher contour for 3D depth lighting
  gl.uniform1f(gl.getUniformLocation(program, "u_angle"), 45.0);
  
  gl.uniform1f(gl.getUniformLocation(program, "u_shape"), 0.0);
  gl.uniform1i(gl.getUniformLocation(program, "u_isImage"), 1); // We are masking with an image!

  // 6. Draw
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  return canvas;
}
