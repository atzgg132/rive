import { fragmentSource, vertexSource } from "@/components/site/webgl/shaders";

export type InkRendererOptions = {
  /** Upper bound for devicePixelRatio. */
  dprCap: number;
  /** Extra render-resolution factor (the canvas is scaled up by CSS). */
  scale: number;
  /** Listen to the pointer (fine pointers only). */
  pointer: boolean;
};

export type InkRenderer = {
  setProgress(value: number): void;
  setIntensity(value: number): void;
  /** Screen-height fractions (from the bottom) the ink bed's top edge moves between as progress runs 0 → 1. */
  setHorizon(start: number, end: number): void;
  /** Height (from the bottom, 0 → 1) above which the ink bed stays clear while the copy is on screen. */
  setCalm(value: number): void;
  /** Move the time cursor on without a loop: draws one frame. */
  draw(): void;
  /** Start or stop the animation loop. Stopping keeps the last frame. */
  setRunning(running: boolean): void;
  resize(cssWidth: number, cssHeight: number): void;
  /** Fixed time cursor for the still frame used under reduced motion. */
  freezeAt(time: number): void;
  destroy(): void;
};

const MIN_SCALE = 0.4;

function compile(gl: WebGLRenderingContext | WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (process.env.NODE_ENV !== "production") console.warn(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Hand-written, single-pass WebGL ink field. Returns null when no WebGL
 * context or shader is available, so the caller can fall back to CSS. */
export function createInkRenderer(canvas: HTMLCanvasElement, options: InkRendererOptions): InkRenderer | null {
  const attributes: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  };
  let gl2 = true;
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = canvas.getContext("webgl2", attributes);
  if (!gl) {
    gl2 = false;
    gl = canvas.getContext("webgl", attributes) as WebGLRenderingContext | null;
  }
  if (!gl) return null;
  const ctx = gl;

  const vs = compile(ctx, ctx.VERTEX_SHADER, vertexSource(gl2));
  const fs = compile(ctx, ctx.FRAGMENT_SHADER, fragmentSource(gl2));
  const program = ctx.createProgram();
  if (!vs || !fs || !program) {
    if (vs) ctx.deleteShader(vs);
    if (fs) ctx.deleteShader(fs);
    if (program) ctx.deleteProgram(program);
    return null;
  }
  ctx.attachShader(program, vs);
  ctx.attachShader(program, fs);
  ctx.linkProgram(program);
  ctx.deleteShader(vs);
  ctx.deleteShader(fs);
  if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
    ctx.deleteProgram(program);
    return null;
  }

  const buffer = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
  ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
  const aPos = ctx.getAttribLocation(program, "aPos");
  const uniform = (name: string) => ctx.getUniformLocation(program, name);
  const uRes = uniform("uRes");
  const uTime = uniform("uTime");
  const uFlow = uniform("uFlow");
  const uProgress = uniform("uProgress");
  const uIntensity = uniform("uIntensity");
  const uEnergy = uniform("uEnergy");
  const uHorizon = uniform("uHorizon");
  const uCalm = uniform("uCalm");
  const uPointer = uniform("uPointer");
  const uPointerAmt = uniform("uPointerAmt");

  ctx.useProgram(program);
  ctx.enable(ctx.BLEND);
  ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);
  ctx.clearColor(0, 0, 0, 0);

  let destroyed = false;
  let running = false;
  let raf = 0;
  let scale = options.scale;
  let cssW = 1;
  let cssH = 1;
  let time = 0;
  let frozen: number | null = null;
  let flow = 0;
  let energy = 0;
  let progress = 0;
  let targetProgress = 0;
  let intensity = 1;
  let horizonStart = 0.3;
  let horizonEnd = 0.8;
  let calm = 0.6;
  let lastNow = 0;
  let lastScrollY = typeof window === "undefined" ? 0 : window.scrollY;
  let scrollVel = 0;
  let pointerX = 0.7;
  let pointerY = 0.3;
  let pointerTargetX = 0.7;
  let pointerTargetY = 0.3;
  let pointerAmt = 0;
  let slowFrames = 0;
  let sampleFrames = 0;
  let sampleStart = performance.now();
  let pointerActive = false;
  let pointerTimer = 0;

  const applySize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, options.dprCap) * scale;
    const w = Math.max(2, Math.round(cssW * dpr));
    const h = Math.max(2, Math.round(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.viewport(0, 0, canvas.width, canvas.height);
  };

  const paint = () => {
    ctx.clear(ctx.COLOR_BUFFER_BIT);
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
    ctx.enableVertexAttribArray(aPos);
    ctx.vertexAttribPointer(aPos, 2, ctx.FLOAT, false, 0, 0);
    ctx.uniform2f(uRes, canvas.width, canvas.height);
    ctx.uniform1f(uTime, frozen ?? time);
    ctx.uniform1f(uFlow, flow);
    ctx.uniform1f(uProgress, progress);
    ctx.uniform1f(uIntensity, intensity);
    ctx.uniform1f(uEnergy, energy);
    ctx.uniform1f(uCalm, calm);
    ctx.uniform1f(uHorizon, horizonStart + (horizonEnd - horizonStart) * progress);
    ctx.uniform2f(uPointer, pointerX, pointerY);
    ctx.uniform1f(uPointerAmt, pointerAmt);
    ctx.drawArrays(ctx.TRIANGLES, 0, 3);
  };

  const step = (now: number) => {
    const dt = Math.min(0.05, lastNow ? (now - lastNow) / 1000 : 0.016);
    lastNow = now;
    if (frozen === null) time += dt;

    const y = window.scrollY;
    const v = dt > 0 ? (y - lastScrollY) / dt : 0;
    lastScrollY = y;
    scrollVel += (Math.min(Math.abs(v), 3000) - scrollVel) * Math.min(1, dt * 6);
    flow += dt * (0.012 + scrollVel * 0.00009);
    energy += (Math.min(1, scrollVel / 1800) - energy) * Math.min(1, dt * 3);

    progress += (targetProgress - progress) * Math.min(1, dt * 7);
    pointerX += (pointerTargetX - pointerX) * Math.min(1, dt * 5);
    pointerY += (pointerTargetY - pointerY) * Math.min(1, dt * 5);
    pointerAmt += ((options.pointer ? 1 : 0) * (pointerActive ? 1 : 0) - pointerAmt) * Math.min(1, dt * 2.5);
  };

  const loop = (now: number) => {
    raf = 0;
    if (destroyed || !running) return;
    step(now);
    paint();

    // Step the render resolution down when the GPU cannot hold ~30fps.
    sampleFrames += 1;
    if (sampleFrames === 40) {
      const avg = (performance.now() - sampleStart) / 40;
      sampleStart = performance.now();
      sampleFrames = 0;
      slowFrames = avg > 34 ? slowFrames + 1 : 0;
      if (slowFrames >= 2 && scale > MIN_SCALE) {
        scale = Math.max(MIN_SCALE, scale * 0.8);
        slowFrames = 0;
        applySize();
      }
    }
    raf = requestAnimationFrame(loop);
  };

  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    pointerTargetX = (event.clientX - rect.left) / rect.width;
    pointerTargetY = 1 - (event.clientY - rect.top) / rect.height;
    pointerActive = true;
    window.clearTimeout(pointerTimer);
    pointerTimer = window.setTimeout(() => {
      pointerActive = false;
    }, 1400);
  };
  if (options.pointer) window.addEventListener("pointermove", onPointer, { passive: true });

  return {
    setProgress(value) {
      targetProgress = Math.min(1, Math.max(0, value));
      if (!running && !destroyed) {
        progress = targetProgress;
        paint();
      }
    },
    setIntensity(value) {
      intensity = value;
      if (!running && !destroyed) paint();
    },
    setHorizon(start, end) {
      horizonStart = start;
      horizonEnd = end;
      if (!running && !destroyed) paint();
    },
    setCalm(value) {
      calm = value;
      if (!running && !destroyed) paint();
    },
    draw() {
      if (destroyed) return;
      progress = targetProgress;
      paint();
    },
    setRunning(next) {
      if (destroyed || next === running) return;
      running = next;
      if (running) {
        lastNow = 0;
        lastScrollY = window.scrollY;
        sampleStart = performance.now();
        sampleFrames = 0;
        raf = requestAnimationFrame(loop);
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    resize(width, height) {
      cssW = Math.max(1, width);
      cssH = Math.max(1, height);
      if (destroyed) return;
      applySize();
      if (!running) paint();
    },
    freezeAt(value) {
      frozen = value;
      flow = 0;
      energy = 0;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(pointerTimer);
      window.removeEventListener("pointermove", onPointer);
      ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
      ctx.deleteBuffer(buffer);
      ctx.useProgram(null);
      ctx.deleteProgram(program);
    },
  };
}
