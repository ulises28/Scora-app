/**
 * SCORA: Apple Liquid Glass Shader Engine (v1.3)
 * 
 * Recreates 3D Apple Liquid Glass visual optics directly inside text & shape glyphs:
 * 1. UNPACK_FLIP_Y_WEBGL Y-axis coordinate alignment with Canvas 2D space.
 * 2. Multi-sample heightmap (Slot 2) for smooth 3D curved glass bevels.
 * 3. Snell's Law optical refraction displacement field.
 * 4. Chromatic dispersion (RGB wavelength fringing).
 * 5. Tight, glistening Blinn-Phong specular glare reflections.
 * 6. Edge-isolated Fresnel rim sheen & deep 3D volumetric edge shadows.
 */

export interface LiquidGlassOptions {
    displacementScale?: number;   // Intensity of light bending (default: 85.0)
    aberrationIntensity?: number; // Chromatic dispersion split factor (default: 0.035)
    blurAmount?: number;          // Backdrop frosting blur in px (default: 20.0)
    tintColor?: [number, number, number]; // Translucent glass tint [r, g, b] (default: [0.92, 0.96, 1.0])
    tintOpacity?: number;         // Translucent tint weight (default: 0.20)
    specularStrength?: number;    // Glossy top-left glare strength (default: 0.85)
    fresnelStrength?: number;     // Edge rim highlight strength (default: 0.65)
}

const vertexShaderSource = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const liquidGlassFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D u_bgTexture;        // Slot 0: Pre-blurred background photo
uniform sampler2D u_maskTexture;      // Slot 1: Crisp alpha shape mask
uniform sampler2D u_heightmapTexture; // Slot 2: Blurred heightmap for 3D bevel
uniform vec2 u_resolution;

uniform float u_displacementScale;
uniform float u_aberration;
uniform vec3 u_tintColor;
uniform float u_tintOpacity;
uniform float u_specularStrength;
uniform float u_fresnelStrength;

in vec2 v_uv;
out vec4 fragColor;

void main() {
    vec2 uv = v_uv;
    vec2 texel = 1.0 / u_resolution;
    
    // 1. Crisp mask alpha threshold
    float maskAlpha = texture(u_maskTexture, uv).a;
    if (maskAlpha < 0.01) {
        fragColor = vec4(0.0);
        return;
    }
    
    // 2. Smooth 3D Bevel Normal calculation from Heightmap (Slot 2)
    float offset = 4.0;
    float hL = texture(u_heightmapTexture, uv - vec2(texel.x * offset, 0.0)).r;
    float hR = texture(u_heightmapTexture, uv + vec2(texel.x * offset, 0.0)).r;
    float hD = texture(u_heightmapTexture, uv - vec2(0.0, texel.y * offset)).r;
    float hU = texture(u_heightmapTexture, uv + vec2(0.0, texel.y * offset)).r;
    
    vec2 slope = vec2(hL - hR, hD - hU) / (2.0 * offset);
    float slopeLen = length(slope);
    vec3 N = normalize(vec3(slope * 50.0, 0.35));
    
    // 3. Snell's Law Refraction Displacement Vector
    vec2 disp = slope * (u_displacementScale / u_resolution);
    
    // 4. Chromatic Dispersion (RGB Wavelength Split)
    vec2 uvR = clamp(uv + disp * (1.0 + u_aberration), vec2(0.001), vec2(0.999));
    vec2 uvG = clamp(uv + disp, vec2(0.001), vec2(0.999));
    vec2 uvB = clamp(uv + disp * (1.0 - u_aberration), vec2(0.001), vec2(0.999));
    
    float rChan = texture(u_bgTexture, uvR).r;
    float gChan = texture(u_bgTexture, uvG).g;
    float bChan = texture(u_bgTexture, uvB).b;
    
    vec3 refractedBg = vec3(rChan, gChan, bChan);
    
    // 5. Specular Glare (Tight, glistening top-left key light reflection)
    vec3 lightDir = normalize(vec3(-0.65, -0.75, 0.70)); // Key light from top-left
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);
    
    float specDot = max(dot(N, halfDir), 0.0);
    float specular = pow(specDot, 48.0) * u_specularStrength * smoothstep(0.01, 0.25, slopeLen);
    
    // 6. Fresnel Edge Rim Contour (Isolated strictly to steep silhouette edges)
    float fresnel = pow(1.0 - max(N.z, 0.0), 3.0) * smoothstep(0.01, 0.20, slopeLen) * u_fresnelStrength;
    
    // 7. 3D Volumetric Edge Lighting & Shadow
    float lightEdge = dot(N.xy, vec2(-0.707, -0.707));
    float edgeHighlight = max(0.0, lightEdge) * 0.35 * smoothstep(0.01, 0.25, slopeLen);
    float edgeShadow = max(0.0, -lightEdge) * 0.45 * smoothstep(0.01, 0.25, slopeLen);
    
    // 8. Translucent Glass Density Tinting & Output
    vec3 finalColor = mix(refractedBg, u_tintColor, u_tintOpacity);
    finalColor = (finalColor * (1.0 - edgeShadow)) + vec3(specular) + vec3(fresnel * 0.85) + vec3(edgeHighlight);
    
    float edgeAlpha = smoothstep(0.0, 0.04, maskAlpha);
    fragColor = vec4(clamp(finalColor, vec3(0.0), vec3(1.0)), edgeAlpha);
}
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compile error (${type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT'}): ${log}`);
    }
    return shader;
}

let cachedGlContext: WebGL2RenderingContext | null = null;
let cachedProgram: WebGLProgram | null = null;

function getGLProgram(gl: WebGL2RenderingContext): WebGLProgram {
    if (cachedGlContext === gl && cachedProgram) {
        return cachedProgram;
    }
    const vShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fShader = createShader(gl, gl.FRAGMENT_SHADER, liquidGlassFragmentShader);

    const program = gl.createProgram()!;
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        throw new Error(`WebGL Program Link Error: ${log}`);
    }
    cachedGlContext = gl;
    cachedProgram = program;
    return program;
}

/**
 * Renders the Liquid Glass effect using WebGL2 directly inside mask shape glyphs.
 */
export function applyLiquidGlassEffect(
    bgCanvas: HTMLCanvasElement,
    maskCanvas: HTMLCanvasElement,
    options: LiquidGlassOptions = {}
): HTMLCanvasElement {
    const width = bgCanvas.width;
    const height = bgCanvas.height;

    const displacementScale = options.displacementScale ?? 85.0;
    const aberrationIntensity = options.aberrationIntensity ?? 0.035;
    const blurAmount = options.blurAmount ?? 20.0;
    const tintColor = options.tintColor ?? [0.92, 0.96, 1.0];
    const tintOpacity = options.tintOpacity ?? 0.20;
    const specularStrength = options.specularStrength ?? 0.85;
    const fresnelStrength = options.fresnelStrength ?? 0.65;

    // 1. Prepare Pre-Blurred Background Canvas for Frosted Glass
    const blurredBgCanvas = document.createElement('canvas');
    blurredBgCanvas.width = width;
    blurredBgCanvas.height = height;
    const blurCtx = blurredBgCanvas.getContext('2d');
    if (blurCtx) {
        if ('filter' in (blurCtx as any)) {
            (blurCtx as any).filter = `blur(${blurAmount}px)`;
            blurCtx.drawImage(bgCanvas, 0, 0);
            (blurCtx as any).filter = 'none';
        } else {
            blurCtx.drawImage(bgCanvas, 0, 0);
            blurCtx.globalAlpha = 0.4;
            const passes = 8;
            for (let i = 0; i < passes; i++) {
                const angle = (i / passes) * Math.PI * 2;
                blurCtx.drawImage(bgCanvas, Math.cos(angle) * (blurAmount * 0.5), Math.sin(angle) * (blurAmount * 0.5));
            }
            blurCtx.globalAlpha = 1.0;
        }
    }

    // 2. Prepare Heightmap Canvas for 3D Bevel Normal Calculation
    const heightmapCanvas = document.createElement('canvas');
    heightmapCanvas.width = width;
    heightmapCanvas.height = height;
    const hCtx = heightmapCanvas.getContext('2d');
    if (hCtx) {
        if ('filter' in (hCtx as any)) {
            (hCtx as any).filter = 'blur(14px)';
            hCtx.drawImage(maskCanvas, 0, 0);
            (hCtx as any).filter = 'none';
        } else {
            hCtx.drawImage(maskCanvas, 0, 0);
        }
    }

    // 3. Setup WebGL2 Context
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, alpha: true });

    if (!gl) {
        console.warn("WebGL2 unavailable for LiquidGlassRenderer; falling back to 2D Canvas pipeline.");
        return applyLiquidGlassFallback2D(bgCanvas, maskCanvas, options);
    }

    try {
        const program = getGLProgram(gl);
        gl.useProgram(program);

        // Align WebGL Y-axis with HTML Canvas 2D (top-left 0,0)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        // 4. Quad Geometry Setup
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

        // 5. Bind Background Texture (Slot 0)
        gl.activeTexture(gl.TEXTURE0);
        const bgTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, bgTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, blurredBgCanvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // 6. Bind Mask Texture (Slot 1)
        gl.activeTexture(gl.TEXTURE1);
        const maskTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, maskTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // 7. Bind Heightmap Texture (Slot 2)
        gl.activeTexture(gl.TEXTURE2);
        const heightmapTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, heightmapTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, heightmapCanvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // 8. Set Uniforms
        gl.uniform1i(gl.getUniformLocation(program, "u_bgTexture"), 0);
        gl.uniform1i(gl.getUniformLocation(program, "u_maskTexture"), 1);
        gl.uniform1i(gl.getUniformLocation(program, "u_heightmapTexture"), 2);
        gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), width, height);

        gl.uniform1f(gl.getUniformLocation(program, "u_displacementScale"), displacementScale);
        gl.uniform1f(gl.getUniformLocation(program, "u_aberration"), aberrationIntensity);
        gl.uniform3f(gl.getUniformLocation(program, "u_tintColor"), tintColor[0], tintColor[1], tintColor[2]);
        gl.uniform1f(gl.getUniformLocation(program, "u_tintOpacity"), tintOpacity);
        gl.uniform1f(gl.getUniformLocation(program, "u_specularStrength"), specularStrength);
        gl.uniform1f(gl.getUniformLocation(program, "u_fresnelStrength"), fresnelStrength);

        // 9. Draw WebGL Quad
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        return canvas;
    } catch (err) {
        console.error("WebGL2 Liquid Glass Shader failed, falling back to 2D canvas:", err);
        return applyLiquidGlassFallback2D(bgCanvas, maskCanvas, options);
    }
}

/**
 * 2D Canvas Fallback pipeline.
 */
function applyLiquidGlassFallback2D(
    bgCanvas: HTMLCanvasElement,
    maskCanvas: HTMLCanvasElement,
    options: LiquidGlassOptions
): HTMLCanvasElement {
    const width = bgCanvas.width;
    const height = bgCanvas.height;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return outCanvas;

    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';

    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = width;
    blurCanvas.height = height;
    const bCtx = blurCanvas.getContext('2d');
    if (bCtx) {
        if ('filter' in (bCtx as any)) {
            (bCtx as any).filter = `blur(${options.blurAmount ?? 20}px)`;
            bCtx.drawImage(bgCanvas, 0, 0);
        } else {
            bCtx.drawImage(bgCanvas, 0, 0);
        }
    }
    ctx.drawImage(blurCanvas, 0, 0);

    ctx.globalAlpha = 0.35;
    ctx.drawImage(bgCanvas, -6, -6);
    ctx.globalAlpha = 1.0;

    ctx.globalCompositeOperation = 'source-over';
    return outCanvas;
}
