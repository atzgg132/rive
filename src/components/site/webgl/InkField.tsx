"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useMotionPaused } from "@/components/site/motion/pause";
import { createInkRenderer, type InkRenderer } from "@/components/site/webgl/inkRenderer";
import styles from "@/components/site/webgl/InkField.module.css";

export type InkFieldHandle = {
  /** 0 → 1: the ink spreads and deepens. Fed by the hero's ScrollTrigger. */
  setProgress(value: number): void;
  /** 0 → 1 overall opacity of the ink. */
  setIntensity(value: number): void;
  /** Where the ink bed's top edge sits at progress 0 and 1, as fractions of the field's height from the bottom. */
  setHorizon(start: number, end: number): void;
  /** Height above which the ink bed stays clear while the copy is on screen. */
  setCalm(value: number): void;
};

const STILL_TIME = 7.5;

/** A full-bleed field of flowing ink on transparent paper. Decorative: the
 * canvas is aria-hidden and never takes pointer events. The loop runs only
 * while the field is on screen, the tab is visible and motion is not paused;
 * under reduced motion it draws one still frame. */
export const InkField = forwardRef<InkFieldHandle, { className?: string; initialProgress?: number }>(
  function InkField({ className = "", initialProgress = 0 }, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<InkRenderer | null>(null);
    const progressRef = useRef(initialProgress);
    const intensityRef = useRef(1);
    const horizonRef = useRef<[number, number]>([0.3, 0.8]);
    const calmRef = useRef(0.6);
    const syncRef = useRef<() => void>(() => undefined);
    const paused = useMotionPaused();
    const pausedRef = useRef(paused);
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useImperativeHandle(
      ref,
      () => ({
        setProgress(value) {
          progressRef.current = value;
          rootRef.current?.style.setProperty("--ink-p", value.toFixed(3));
          rendererRef.current?.setProgress(value);
        },
        setIntensity(value) {
          intensityRef.current = value;
          rendererRef.current?.setIntensity(value);
        },
        setCalm(value) {
          calmRef.current = value;
          rendererRef.current?.setCalm(value);
        },
        setHorizon(start, end) {
          horizonRef.current = [start, end];
          rendererRef.current?.setHorizon(start, end);
        },
      }),
      [],
    );

    useEffect(() => {
      pausedRef.current = paused;
      syncRef.current();
    }, [paused]);

    useEffect(() => {
      const canvas = canvasRef.current;
      const root = rootRef.current;
      if (!canvas || !root) return;

      const small = window.matchMedia("(max-width: 767px)").matches;
      const fine = window.matchMedia("(pointer: fine)").matches;
      const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

      const renderer = createInkRenderer(canvas, {
        dprCap: small ? 1.25 : 1.5,
        scale: small ? 0.6 : 0.8,
        pointer: fine && !small,
      });
      if (!renderer) {
        setFailed(true);
        return;
      }
      setFailed(false);
      rendererRef.current = renderer;
      renderer.setProgress(progressRef.current);
      renderer.setIntensity(intensityRef.current);
      renderer.setHorizon(...horizonRef.current);
      renderer.setCalm(calmRef.current);

      let visible = true;
      let revealed = false;
      const sync = () => {
        const reduce = reduceQuery.matches;
        if (reduce) renderer.freezeAt(STILL_TIME);
        const run = visible && !document.hidden && !pausedRef.current && !reduce;
        renderer.setRunning(run);
        if (!run) renderer.draw();
        if (!revealed) {
          revealed = true;
          setReady(true);
        }
      };
      syncRef.current = sync;

      const resizeObserver = new ResizeObserver(([entry]) => {
        const box = entry.contentRect;
        renderer.resize(box.width, box.height);
      });
      resizeObserver.observe(root);
      const rect = root.getBoundingClientRect();
      renderer.resize(rect.width, rect.height);

      const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        sync();
      });
      intersection.observe(root);

      const onLost = (event: Event) => {
        event.preventDefault();
        renderer.setRunning(false);
        setFailed(true);
      };
      const onRestored = () => setAttempt((n) => n + 1);

      document.addEventListener("visibilitychange", sync);
      reduceQuery.addEventListener("change", sync);
      canvas.addEventListener("webglcontextlost", onLost);
      canvas.addEventListener("webglcontextrestored", onRestored);
      sync();

      return () => {
        syncRef.current = () => undefined;
        rendererRef.current = null;
        resizeObserver.disconnect();
        intersection.disconnect();
        document.removeEventListener("visibilitychange", sync);
        reduceQuery.removeEventListener("change", sync);
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
        renderer.destroy();
      };
    }, [attempt]);

    return (
      <div ref={rootRef} className={`${styles.root} ${className}`} aria-hidden="true">
        {failed ? <div className={styles.fallback} /> : null}
        <canvas ref={canvasRef} className={`${styles.canvas} ${ready && !failed ? styles.ready : ""}`} />
      </div>
    );
  },
);
