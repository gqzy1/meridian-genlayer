import { CONTINENT_POLYGONS } from "./globeData";

export type GlobeTheme = "earth" | "twilight" | "crystal";

const VERTEX_SHADER_SRC = `
attribute vec2 aPos;
varying vec2 vQuad;
void main() {
  vQuad = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `
precision highp float;

varying vec2 vQuad;

uniform float uRotY;
uniform float uRotX;
uniform float uTime;
uniform float uPad;
uniform float uNightMix;
uniform float uClouds;
uniform float uHasWater;
uniform float uHasBump;
uniform float uHasNight;

uniform sampler2D uDayTex;
uniform sampler2D uNightTex;
uniform sampler2D uBumpTex;
uniform sampler2D uWaterTex;

const float PI = 3.14159265359;

// Fast seamless 3D value noise for distortion-free volumetric Earth clouds
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash3(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash3(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbm3(vec3 p) {
  float v = 0.0;
  float amp = 0.52;
  for (int i = 0; i < 4; i++) {
    v += amp * noise3(p);
    p = p * 2.07 + vec3(11.3, 7.1, 19.7);
    amp *= 0.5;
  }
  return v;
}

float sampleClouds(vec3 pObj, float t) {
  float ca = cos(t * 0.016);
  float sa = sin(t * 0.016);
  vec3 pc = vec3(pObj.x * ca + pObj.z * sa, pObj.y, -pObj.x * sa + pObj.z * ca);
  // Subtle Coriolis latitude swirl
  float latSwirl = pc.y * 1.4;
  float cs = cos(latSwirl * 0.35);
  float ss = sin(latSwirl * 0.35);
  vec3 pSwirl = vec3(pc.x * cs - pc.z * ss, pc.y * 1.15, pc.x * ss + pc.z * cs);

  vec3 q = vec3(
    fbm3(pSwirl * 2.4 + vec3(0.0, 1.7, 3.1)),
    fbm3(pSwirl * 2.4 + vec3(5.2, 1.3, 2.8)),
    fbm3(pSwirl * 2.4 + vec3(2.1, 6.4, 1.9))
  );
  float c = fbm3(pSwirl * 3.1 + q * 1.15);
  // Naturally denser cloud belts in mid-latitudes & tropics
  float band = 0.88 + 0.22 * cos(pObj.y * 4.2);
  return smoothstep(0.54, 0.78, c * band);
}

vec3 forwardRotate(vec3 p, float ry, float rx) {
  float cy = cos(ry);
  float sy = sin(ry);
  float x1 = p.x * cy + p.z * sy;
  float z1 = -p.x * sy + p.z * cy;
  float cx = cos(rx);
  float sx = sin(rx);
  float y2 = p.y * cx - z1 * sx;
  float z2 = p.y * sx + z1 * cx;
  return vec3(x1, y2, z2);
}

void main() {
  // Match Canvas2D coordinates: nx right (+), ny down (+)
  float nx = vQuad.x * uPad;
  float ny = -vQuad.y * uPad;
  float r2 = nx * nx + ny * ny;
  float r = sqrt(r2);

  // Sun coming from upper-left-front (in Canvas2D space -y is UP)
  vec3 sunDir = normalize(mix(
    vec3(-0.58, -0.42, 0.70),
    vec3(-0.82, -0.25, 0.22),
    uNightMix
  ));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  // Outer Rayleigh atmospheric halo outside unit sphere
  if (r >= 1.0) {
    float dist = (r - 1.0) / max(0.001, (uPad - 1.0));
    if (dist >= 1.0) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec2 dir2 = vec2(nx, ny) / max(r, 0.0001);
    float sunSide = clamp(dot(normalize(vec3(dir2, 0.22)), sunDir) * 0.55 + 0.52, 0.2, 1.0);
    float halo = exp(-dist * 4.4) * (1.0 - dist);
    vec3 haloColor = mix(
      vec3(0.32, 0.74, 0.99),
      vec3(0.76, 0.93, 1.0),
      pow(halo, 1.5) * sunSide
    );
    float haloAlpha = clamp(halo * (0.62 + 0.28 * sunSide), 0.0, 0.88);
    gl_FragColor = vec4(haloColor * haloAlpha, haloAlpha);
    return;
  }

  float nz = sqrt(max(0.0, 1.0 - r2));

  // Inverse rotation matching MeridianGlobe.tsx screenToLatLng 1:1
  float cosX = cos(uRotX);
  float sinX = sin(uRotX);
  float y1 = ny * cosX + nz * sinX;
  float z1 = -ny * sinX + nz * cosX;

  float cosY = cos(uRotY);
  float sinY = sin(uRotY);
  float x0 = nx * cosY - z1 * sinY;
  float z0 = nx * sinY + z1 * cosY;

  vec3 pObj = normalize(vec3(x0, y1, z0));

  float lat = asin(clamp(-y1, -1.0, 1.0));
  float lng = atan(x0, z0 + 1e-6);

  float u = lng / (2.0 * PI) + 0.5;
  float v = 0.5 - lat / PI;

  vec3 dayCol = texture2D(uDayTex, vec2(u, v)).rgb;

  // Water mask for specular ocean sun glint (falls back to blue-channel ocean heuristic until loaded)
  float oceanMask;
  if (uHasWater > 0.5) {
    oceanMask = texture2D(uWaterTex, vec2(u, v)).r;
  } else {
    float blueLead = dayCol.b - max(dayCol.r, dayCol.g) * 0.92;
    oceanMask = smoothstep(0.02, 0.14, blueLead);
  }

  // Subtle topographic normal perturbation for crisp mountain relief
  vec3 N = vec3(nx, ny, nz);
  if (uHasBump > 0.5) {
    float poleFade = smoothstep(0.992, 0.90, abs(y1));
    float epsU = 0.0011;
    float epsV = 0.0018;
    float hL = texture2D(uBumpTex, vec2(u - epsU, v)).r;
    float hR = texture2D(uBumpTex, vec2(u + epsU, v)).r;
    float hU = texture2D(uBumpTex, vec2(u, clamp(v - epsV, 0.001, 0.999))).r;
    float hD = texture2D(uBumpTex, vec2(u, clamp(v + epsV, 0.001, 0.999))).r;

    vec2 hor = vec2(z0, -x0);
    float horLen = length(hor);
    if (horLen > 0.001) {
      vec3 T0 = vec3(hor.x / horLen, 0.0, hor.y / horLen);
      vec3 B0 = normalize(cross(pObj, T0));
      float landWeight = (1.0 - oceanMask * 0.85) * poleFade * 1.65;
      vec3 bumpedObj = normalize(
        pObj - (hR - hL) * landWeight * T0 - (hD - hU) * landWeight * B0
      );
      N = normalize(forwardRotate(bumpedObj, uRotY, uRotX));
    }
  }

  // Crisp realistic color grading so oceans look vivid sapphire & continents stay clean and rich
  vec3 gradedDay = pow(dayCol, vec3(0.95));
  // Gentle sapphire richness on oceans while preserving authentic natural land tones
  vec3 oceanTint = mix(gradedDay, gradedDay * vec3(0.84, 0.97, 1.18) + vec3(0.0, 0.02, 0.06), 0.45);
  vec3 albedo = mix(gradedDay * 1.07, oceanTint, oceanMask);

  // Physically-inspired diffuse + soft sky bounce ambient (no harsh pitch-black hole in daylight)
  float ndl = dot(N, sunDir);
  float dayFactor = smoothstep(-0.22, 0.32, ndl);
  float diffuse = max(0.0, ndl);
  float ambientFloor = mix(0.28, 0.09, uNightMix);
  float lightIntensity = ambientFloor + diffuse * (1.08 - ambientFloor * 0.65);

  vec3 litSurface = albedo * lightIntensity;

  // Shimmering ocean solar specular highlight
  vec3 halfVec = normalize(sunDir + viewDir);
  float specPow = mix(38.0, 56.0, uNightMix);
  float spec = pow(max(0.0, dot(N, halfVec)), specPow) * oceanMask * smoothstep(-0.05, 0.25, ndl);
  litSurface += vec3(0.76, 0.92, 1.0) * spec * 0.58;

  // Golden city lights gently glowing on the twilight / dark side
  if (uHasNight > 0.5) {
    vec3 nightTex = texture2D(uNightTex, vec2(u, v)).rgb;
    float nightMask = smoothstep(0.16, -0.32, ndl);
    float cityBoost = mix(0.68, 1.45, uNightMix);
    litSurface += nightTex * vec3(1.05, 0.84, 0.54) * nightMask * cityBoost;
  }

  // Drifting volumetric cloud layer with subtle terrain drop-shadows
  if (uClouds > 0.5) {
    float cloud = sampleClouds(pObj, uTime);
    // Approximate sun direction in unrotated object space for cloud shadow offset
    vec3 sunObj = normalize(vec3(
      sunDir.x * cosY - (sunDir.z * cosX - sunDir.y * sinX) * sinY,
      sunDir.y * cosX + sunDir.z * sinX,
      sunDir.x * sinY + (sunDir.z * cosX - sunDir.y * sinX) * cosY
    ));
    float cloudShadow = sampleClouds(normalize(pObj + sunObj * 0.015), uTime);
    litSurface *= 1.0 - cloudShadow * 0.22 * dayFactor;

    vec3 cloudColor = mix(
      vec3(0.46, 0.64, 0.84),
      vec3(1.0, 1.0, 1.0),
      clamp(ambientFloor * 1.2 + diffuse * 0.98, 0.0, 1.0)
    );
    litSurface = mix(litSurface, cloudColor, cloud * 0.72);
  }

  // Inner Rayleigh atmospheric limb scattering (vivid sapphire-cyan rim glow)
  float fresnel = pow(1.0 - nz, 2.75);
  float sunRim = clamp(dot(vec3(nx, ny, nz), sunDir) * 0.5 + 0.62, 0.22, 1.0);
  vec3 atmoColor = mix(vec3(0.16, 0.56, 0.96), vec3(0.68, 0.92, 1.0), fresnel * sunRim);
  litSurface = mix(litSurface, atmoColor, fresnel * (0.62 * sunRim));
  litSurface += vec3(0.42, 0.82, 1.0) * pow(1.0 - nz, 5.2) * 0.45 * sunRim;

  // Smooth anti-aliased edge transition into outer atmospheric halo
  float edgeAA = smoothstep(1.0, 0.992, r);
  float rimAlpha = clamp(edgeAA + (1.0 - edgeAA) * 0.72, 0.0, 1.0);
  vec3 finalRgb = mix(vec3(0.54, 0.84, 1.0), litSurface, edgeAA);

  gl_FragColor = vec4(finalRgb * rimAlpha, rimAlpha);
}
`;

const DAY_URLS = [
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg",
  "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg",
];

const NIGHT_URLS = [
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg",
  "https://unpkg.com/three-globe/example/img/earth-night.jpg",
];

const BUMP_URLS = [
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png",
  "https://unpkg.com/three-globe/example/img/earth-topology.png",
];

const WATER_URLS = [
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-water.png",
  "https://unpkg.com/three-globe/example/img/earth-water.png",
];

function createProceduralEarthCanvas(): HTMLCanvasElement {
  const w = 1024;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  // Realistic ocean bathymetry gradient
  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, "#d8ecfa");
  ocean.addColorStop(0.08, "#2969a8");
  ocean.addColorStop(0.5, "#154984");
  ocean.addColorStop(0.92, "#2969a8");
  ocean.addColorStop(1, "#e2f1fc");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);

  // Continents with realistic verdant/desert/polar tones as immediate frame-1 placeholder
  CONTINENT_POLYGONS.forEach((poly) => {
    ctx.beginPath();
    poly.forEach(([lat, lng], idx) => {
      const x = ((lng + 180) / 360) * w;
      const y = ((90 - lat) / 180) * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    const landGrad = ctx.createLinearGradient(0, 0, 0, h);
    landGrad.addColorStop(0, "#e6f0f6");
    landGrad.addColorStop(0.18, "#6a9165");
    landGrad.addColorStop(0.36, "#8fa868");
    landGrad.addColorStop(0.48, "#b7a572");
    landGrad.addColorStop(0.6, "#5d8e58");
    landGrad.addColorStop(0.84, "#92a36c");
    landGrad.addColorStop(1, "#e6f0f6");
    ctx.fillStyle = landGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(182, 224, 248, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  return c;
}

function loadImageWithFallback(urls: string[]): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let index = 0;
    const tryNext = () => {
      if (index >= urls.length) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => {
        index += 1;
        tryNext();
      };
      img.src = urls[index];
    };
    tryNext();
  });
}

function toPowerOfTwoCanvas(
  img: HTMLImageElement,
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = targetW;
  c.height = targetH;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.drawImage(img, 0, 0, targetW, targetH);
  }
  return c;
}

export class EarthRenderer {
  public readonly canvas: HTMLCanvasElement;
  public readonly supported: boolean;
  public readonly padRatio = 1.2;

  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private textures: Record<"day" | "night" | "bump" | "water", WebGLTexture | null> = {
    day: null,
    night: null,
    bump: null,
    water: null,
  };
  private hasWater = false;
  private hasBump = false;
  private hasNight = false;
  private disposed = false;

  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 768;
    this.canvas.height = 768;

    const gl = this.canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      this.supported = false;
      return;
    }

    this.gl = gl;
    this.supported = this.initPipeline(gl);
    if (this.supported) {
      this.uploadProceduralFallback(gl);
      void this.loadRealTextures();
    }
  }

  private compileShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private initPipeline(gl: WebGLRenderingContext): boolean {
    const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) return false;

    const program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return false;
    }

    this.program = program;
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const names = [
      "uRotY",
      "uRotX",
      "uTime",
      "uPad",
      "uNightMix",
      "uClouds",
      "uHasWater",
      "uHasBump",
      "uHasNight",
      "uDayTex",
      "uNightTex",
      "uBumpTex",
      "uWaterTex",
    ];
    names.forEach((name) => {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    });

    this.textures.day = this.createEmptyTexture(gl, 0);
    this.textures.night = this.createEmptyTexture(gl, 1);
    this.textures.bump = this.createEmptyTexture(gl, 2);
    this.textures.water = this.createEmptyTexture(gl, 3);

    gl.uniform1i(this.uniforms.uDayTex, 0);
    gl.uniform1i(this.uniforms.uNightTex, 1);
    gl.uniform1i(this.uniforms.uBumpTex, 2);
    gl.uniform1i(this.uniforms.uWaterTex, 3);

    return true;
  }

  private createEmptyTexture(
    gl: WebGLRenderingContext,
    unit: number
  ): WebGLTexture | null {
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  private uploadCanvasTexture(
    gl: WebGLRenderingContext,
    tex: WebGLTexture | null,
    unit: number,
    source: HTMLCanvasElement
  ): void {
    if (!tex) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  private uploadProceduralFallback(gl: WebGLRenderingContext): void {
    const fallback = createProceduralEarthCanvas();
    this.uploadCanvasTexture(gl, this.textures.day, 0, fallback);
  }

  private async loadRealTextures(): Promise<void> {
    const [dayImg, nightImg, bumpImg, waterImg] = await Promise.all([
      loadImageWithFallback(DAY_URLS),
      loadImageWithFallback(NIGHT_URLS),
      loadImageWithFallback(BUMP_URLS),
      loadImageWithFallback(WATER_URLS),
    ]);

    if (this.disposed || !this.gl) return;
    const gl = this.gl;

    if (dayImg) {
      this.uploadCanvasTexture(
        gl,
        this.textures.day,
        0,
        toPowerOfTwoCanvas(dayImg, 2048, 1024)
      );
    }
    if (nightImg) {
      this.uploadCanvasTexture(
        gl,
        this.textures.night,
        1,
        toPowerOfTwoCanvas(nightImg, 2048, 1024)
      );
      this.hasNight = true;
    }
    if (bumpImg) {
      this.uploadCanvasTexture(
        gl,
        this.textures.bump,
        2,
        toPowerOfTwoCanvas(bumpImg, 1024, 512)
      );
      this.hasBump = true;
    }
    if (waterImg) {
      this.uploadCanvasTexture(
        gl,
        this.textures.water,
        3,
        toPowerOfTwoCanvas(waterImg, 1024, 512)
      );
      this.hasWater = true;
    }
  }

  public render(
    rotY: number,
    rotX: number,
    timeSec: number,
    pixelSize: number,
    options: { theme: GlobeTheme; showClouds: boolean }
  ): HTMLCanvasElement | null {
    if (!this.supported || !this.gl || !this.program) return null;
    const gl = this.gl;

    const clampedSize = Math.max(256, Math.min(1280, Math.round(pixelSize)));
    if (
      Math.abs(this.canvas.width - clampedSize) > 24 ||
      Math.abs(this.canvas.height - clampedSize) > 24
    ) {
      this.canvas.width = clampedSize;
      this.canvas.height = clampedSize;
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.uniform1f(this.uniforms.uRotY, rotY);
    gl.uniform1f(this.uniforms.uRotX, rotX);
    gl.uniform1f(this.uniforms.uTime, timeSec);
    gl.uniform1f(this.uniforms.uPad, this.padRatio);
    gl.uniform1f(
      this.uniforms.uNightMix,
      options.theme === "twilight" ? 0.82 : 0.14
    );
    gl.uniform1f(this.uniforms.uClouds, options.showClouds ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.uHasWater, this.hasWater ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.uHasBump, this.hasBump ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.uHasNight, this.hasNight ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }

  public dispose(): void {
    this.disposed = true;
    if (!this.gl) return;
    const gl = this.gl;
    Object.values(this.textures).forEach((t) => {
      if (t) gl.deleteTexture(t);
    });
    if (this.program) gl.deleteProgram(this.program);
    this.gl = null;
    this.program = null;
  }
}
