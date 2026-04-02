"use client";

import { useEffect, useRef } from "react";

/**
 * ASOE Gravitational Orbs — Light Theme
 *
 * Three orbital systems with rotating rings, particle trails,
 * traveling beam pulses, and mouse parallax. Colors use ASOE
 * brand/category palette: brand blue, violet, teal.
 */
export function GravitationalOrbs() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w: number, h: number;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };
    canvas.addEventListener("mousemove", handleMouse);

    // ASOE palette: brand blue, violet (cat-purple), teal (cat-teal)
    const orbs = [
      { cx: 0.26, cy: 0.42, r: 0.24, color: [0, 122, 255], colorEnd: [50, 173, 230], rings: 5, speed: 0.10, rotSpeed: 0.15 },
      { cx: 0.74, cy: 0.50, r: 0.19, color: [88, 86, 214], colorEnd: [175, 130, 255], rings: 4, speed: 0.08, rotSpeed: -0.12 },
      { cx: 0.50, cy: 0.20, r: 0.13, color: [0, 199, 190], colorEnd: [50, 214, 255], rings: 3, speed: 0.14, rotSpeed: 0.18 },
    ];

    const particles = orbs.flatMap((orb, oi) =>
      Array.from({ length: 45 }, () => ({
        orbIdx: oi,
        angle: Math.random() * Math.PI * 2,
        dist: orb.r * (0.3 + Math.random() * 0.95),
        speed: (0.06 + Math.random() * 0.14) * (Math.random() < 0.5 ? 1 : -1),
        size: 0.8 + Math.random() * 2.5,
        alpha: 0.12 + Math.random() * 0.35,
        eccentric: 0.4 + Math.random() * 0.5,
        tilt: Math.random() * Math.PI,
        trail: [] as { x: number; y: number }[],
      }))
    );

    const draw = (t: number) => {
      const time = t * 0.001;
      ctx.clearRect(0, 0, w, h);

      // Match ASOE surface-page background
      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(0, 0, w, h);

      const minDim = Math.min(w, h);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Background wash: soft colored zones behind each orb
      for (const orb of orbs) {
        const cx = orb.cx * w + Math.sin(time * orb.speed) * w * 0.02;
        const cy = orb.cy * h + Math.cos(time * orb.speed * 1.3) * h * 0.02;
        const washR = orb.r * minDim * 1.8;

        const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, washR);
        wash.addColorStop(0, `rgba(${orb.color.join(",")},0.055)`);
        wash.addColorStop(0.5, `rgba(${orb.colorEnd.join(",")},0.025)`);
        wash.addColorStop(1, `rgba(${orb.color.join(",")},0)`);
        ctx.fillStyle = wash;
        ctx.beginPath();
        ctx.arc(cx, cy, washR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw each orb system
      for (let oi = 0; oi < orbs.length; oi++) {
        const orb = orbs[oi];
        const parallax = 0.01 * (oi + 1);
        const cx = orb.cx * w + Math.sin(time * orb.speed) * w * 0.02 + (mx - 0.5) * w * parallax;
        const cy = orb.cy * h + Math.cos(time * orb.speed * 1.3) * h * 0.02 + (my - 0.5) * h * parallax;
        const baseR = orb.r * minDim;

        // Gradient core fill
        const coreR = baseR * 0.32;
        const coreFill = ctx.createRadialGradient(cx - coreR * 0.2, cy - coreR * 0.25, 0, cx, cy, coreR);
        coreFill.addColorStop(0, `rgba(${orb.colorEnd.join(",")},0.18)`);
        coreFill.addColorStop(0.5, `rgba(${orb.color.join(",")},0.10)`);
        coreFill.addColorStop(1, `rgba(${orb.color.join(",")},0)`);
        ctx.fillStyle = coreFill;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fill();

        // Concentric rings
        for (let r = 0; r < orb.rings; r++) {
          const ringR = baseR * (0.25 + r * 0.17);
          const breathe = 1 + Math.sin(time * 0.4 + r * 1.1) * 0.025;
          const ringAlpha = 0.12 - r * 0.015;
          const rotation = time * orb.rotSpeed * (r % 2 === 0 ? 1 : -0.6);

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rotation);

          if (r < 2) {
            ctx.setLineDash([Math.max(3, ringR * 0.08), Math.max(6, ringR * 0.15)]);
          } else {
            ctx.setLineDash([]);
          }

          const segments = 60;
          for (let s = 0; s < segments; s++) {
            const a1 = (s / segments) * Math.PI * 2;
            const a2 = ((s + 1) / segments) * Math.PI * 2;
            const segAlpha = ringAlpha * (0.5 + Math.sin(a1 + time * 0.5 + r) * 0.5);

            ctx.strokeStyle = `rgba(${orb.color.join(",")},${segAlpha})`;
            ctx.lineWidth = r === 0 ? 1.5 : 1;
            ctx.beginPath();
            ctx.arc(0, 0, ringR * breathe, a1, a2);
            ctx.stroke();
          }

          ctx.setLineDash([]);
          ctx.restore();

          // Ring marker dots
          const markerAngle = time * orb.rotSpeed * 2 + r * Math.PI * 0.7;
          const markerX = cx + Math.cos(markerAngle) * ringR * breathe;
          const markerY = cy + Math.sin(markerAngle) * ringR * breathe;
          const markerGlow = ctx.createRadialGradient(markerX, markerY, 0, markerX, markerY, 6);
          markerGlow.addColorStop(0, `rgba(${orb.color.join(",")},0.35)`);
          markerGlow.addColorStop(1, `rgba(${orb.color.join(",")},0)`);
          ctx.fillStyle = markerGlow;
          ctx.beginPath();
          ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(${orb.color.join(",")},0.6)`;
          ctx.beginPath();
          ctx.arc(markerX, markerY, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bright center dot with bloom
        const bloomR = 12 + Math.sin(time * 1.2 + oi) * 3;
        const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
        bloom.addColorStop(0, `rgba(${orb.color.join(",")},0.30)`);
        bloom.addColorStop(0.4, `rgba(${orb.color.join(",")},0.10)`);
        bloom.addColorStop(1, `rgba(${orb.color.join(",")},0)`);
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(cx, cy, bloomR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${orb.color.join(",")},0.55)`;
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${orb.colorEnd.join(",")},0.9)`;
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Inter-orb connection beams with traveling pulse
      for (let i = 0; i < orbs.length; i++) {
        for (let j = i + 1; j < orbs.length; j++) {
          const a = orbs[i], b = orbs[j];
          const ax = a.cx * w + Math.sin(time * a.speed) * w * 0.02 + (mx - 0.5) * w * 0.01 * (i + 1);
          const ay = a.cy * h + Math.cos(time * a.speed * 1.3) * h * 0.02 + (my - 0.5) * h * 0.01 * (i + 1);
          const bx = b.cx * w + Math.sin(time * b.speed) * w * 0.02 + (mx - 0.5) * w * 0.01 * (j + 1);
          const by = b.cy * h + Math.cos(time * b.speed * 1.3) * h * 0.02 + (my - 0.5) * h * 0.01 * (j + 1);

          const beamGrad = ctx.createLinearGradient(ax, ay, bx, by);
          beamGrad.addColorStop(0, `rgba(${a.color.join(",")},0.08)`);
          beamGrad.addColorStop(0.5, `rgba(${a.color.join(",")},0.03)`);
          beamGrad.addColorStop(1, `rgba(${b.color.join(",")},0.08)`);
          ctx.strokeStyle = beamGrad;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();

          const pulsePos = Math.sin(time * 0.8 + i + j) * 0.5 + 0.5;
          const ppx = ax + (bx - ax) * pulsePos;
          const ppy = ay + (by - ay) * pulsePos;
          const pg = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, 8);
          pg.addColorStop(0, `rgba(${a.color.join(",")},0.35)`);
          pg.addColorStop(1, `rgba(${a.color.join(",")},0)`);
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.arc(ppx, ppy, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Particles with trails
      for (const p of particles) {
        const orb = orbs[p.orbIdx];
        const parallax = 0.01 * (p.orbIdx + 1);
        const cx = orb.cx * w + Math.sin(time * orb.speed) * w * 0.02 + (mx - 0.5) * w * parallax;
        const cy = orb.cy * h + Math.cos(time * orb.speed * 1.3) * h * 0.02 + (my - 0.5) * h * parallax;

        p.angle += p.speed * 0.009;
        const tiltedAngle = p.angle + time * p.speed * 0.35;
        const localX = Math.cos(tiltedAngle) * p.dist * minDim;
        const localY = Math.sin(tiltedAngle) * p.dist * minDim * p.eccentric;

        const cosT = Math.cos(p.tilt);
        const sinT = Math.sin(p.tilt);
        const px = cx + localX * cosT - localY * sinT;
        const py = cy + localX * sinT + localY * cosT;

        p.trail.push({ x: px, y: py });
        if (p.trail.length > 8) p.trail.shift();

        if (p.trail.length > 2 && p.size > 1.2) {
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let ti = 1; ti < p.trail.length; ti++) {
            ctx.lineTo(p.trail[ti].x, p.trail[ti].y);
          }
          ctx.strokeStyle = `rgba(${orb.color.join(",")},${p.alpha * 0.15})`;
          ctx.lineWidth = p.size * 0.5;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        const dx = px - cx, dy = py - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const maxD = orb.r * minDim * 1.2;
        const distAlpha = Math.max(0, 1 - d / maxD);

        if (p.size > 1.8) {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3);
          glow.addColorStop(0, `rgba(${orb.color.join(",")},${p.alpha * distAlpha * 0.3})`);
          glow.addColorStop(1, `rgba(${orb.color.join(",")},0)`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(${orb.color.join(",")},${p.alpha * distAlpha})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
