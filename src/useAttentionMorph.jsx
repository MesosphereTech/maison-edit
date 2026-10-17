import { useLayoutEffect, useRef } from "react";
import {
  ATTENTION_LAP_MS,
  PARTICLE_FLIGHT_MS,
  PARTICLE_STAGGER_MS,
  PARTICLE_COUNT,
  ARRIVAL_PULSE_MS,
  attentionRoute,
  pointOnAttentionRoute,
} from "./attention-motion.js";

// The contour belongs to the product. A single gold particle trail carries
// attention into the same live companion surface. Copy is already readable.
export function useAttentionMorph({ frameRef, asideRef, attention, active }) {
  const presented = useRef(null);
  useLayoutEffect(() => {
    const shell = frameRef.current;
    const aside = asideRef.current;
    if (!shell || !aside || !attention?.rect || !active) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const outline = shell.querySelector(".attention-shell-outline");
    const animations = [];
    const timers = new Set();
    let field, halo, source, destination, bubble;
    let disposed = false;
    let finished = false;
    const token = String(attention.token);
    aside.dataset.attentionToken = token;
    const phase = (value) => {
      shell.dataset.phase = value;
      if (aside.dataset.attentionToken === token)
        aside.dataset.attentionPhase = value;
    };
    const after = (callback, delay) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!disposed && !finished) callback();
      }, delay);
      timers.add(timer);
    };
    const settle = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      timers.clear();
      animations.forEach((animation) => animation.cancel());
      field?.remove();
      halo?.remove();
      bubble?.classList.remove("has-attention-arrival");
      phase("settled");
      shell.style.visibility = "hidden";
    };
    const readSource = () => {
      if (!attention.element?.isConnected) return null;
      const visual =
        attention.element.querySelector(".product-visual,.detail-visual") ||
        attention.element;
      const box = visual.getBoundingClientRect();
      if (!box.width || !box.height) return null;
      const header = attention.element.closest(".modal")
        ? 0
        : Math.max(
            0,
            document.querySelector(".site-header")?.getBoundingClientRect()
              .bottom || 0,
          );
      const left = Math.max(3, box.left);
      const top = Math.max(3, header + 3, box.top);
      const right = Math.min(innerWidth - 3, box.right);
      const bottom = Math.min(innerHeight - 3, box.bottom);
      return right > left && bottom > top
        ? { left, top, width: right - left, height: bottom - top }
        : null;
    };
    const readDestination = () => {
      if (!bubble?.isConnected) return null;
      const box = bubble.getBoundingClientRect();
      const clip = bubble.closest(".subtitle-bubbles")?.getBoundingClientRect();
      const left = Math.max(3, box.left, clip?.left ?? 0);
      const top = Math.max(3, box.top, clip?.top ?? 0);
      const right = Math.min(
        innerWidth - 3,
        box.right,
        clip?.right ?? innerWidth,
      );
      const bottom = Math.min(
        innerHeight - 3,
        box.bottom,
        clip?.bottom ?? innerHeight,
      );
      return right > left && bottom > top
        ? { left, top, width: right - left, height: bottom - top }
        : null;
    };
    const changed = (first, next) =>
      !first ||
      !next ||
      ["left", "top", "width", "height"].some(
        (key) => Math.abs(first[key] - next[key]) > 3,
      );
    const track = () => {
      const next = readSource();
      if (!next) return settle();
      // Never send a stale trail toward a position the shopper has left.
      if (
        field &&
        (changed(source, next) || changed(destination, readDestination()))
      )
        return settle();
      source = next;
      Object.assign(shell.style, {
        width: `${source.width}px`,
        height: `${source.height}px`,
        transform: `translate3d(${source.left}px, ${source.top}px, 0)`,
      });
    };
    track();
    const unsubscribe = attention.subscribe?.(track);
    const alreadyPresented = presented.current === attention.token;
    presented.current = attention.token;
    if (motion.matches || alreadyPresented || finished || !outline) {
      settle();
      return () => {
        unsubscribe?.();
        if (aside.dataset.attentionToken === token) {
          delete aside.dataset.attentionPhase;
          delete aside.dataset.attentionToken;
        }
      };
    }
    phase("glow-lap");
    shell.style.visibility = "visible";
    halo = outline.cloneNode();
    halo.removeAttribute("class");
    halo.classList.add("attention-shell-halo");
    outline.before(halo);
    animations.push(
      halo.animate(
        [
          { opacity: 0 },
          { opacity: 0.5, offset: 0.14 },
          { opacity: 0.5, offset: 0.82 },
          { opacity: 0 },
        ],
        {
          duration: ATTENTION_LAP_MS + 100,
          easing: "ease-in-out",
          fill: "both",
        },
      ),
      outline.animate(
        [
          { strokeDashoffset: "100", opacity: 0 },
          { strokeDashoffset: "93", opacity: 1, offset: 0.07 },
          { strokeDashoffset: "7", opacity: 1, offset: 0.93 },
          { strokeDashoffset: "0", opacity: 0 },
        ],
        { duration: ATTENTION_LAP_MS, easing: "linear", fill: "both" },
      ),
    );
    after(() => {
      track();
      if (finished) return;
      bubble = aside.querySelector(
        "[data-persistent-surface]:not(.is-retiring)",
      );
      if (!bubble) return settle();
      destination = readDestination();
      if (!destination?.width || !destination.height) return settle();
      phase("particles");
      shell.style.visibility = "hidden";
      const composer = document
        .querySelector(".subtitle-composer")
        ?.getBoundingClientRect();
      const route = attentionRoute(source, destination, {
        avoid: composer?.width ? [composer] : [],
      });
      field = document.createElement("div");
      field.className = "concierge-particle-field";
      field.setAttribute("aria-hidden", "true");
      field.dataset.attentionToken = token;
      field.dataset.origin = `${Math.round(route.start.x)},${Math.round(route.start.y)}`;
      field.dataset.destination = `${Math.round(route.end.x)},${Math.round(route.end.y)}`;
      document.body.append(field);
      for (let index = 0; index < PARTICLE_COUNT; index++) {
        const pixel = document.createElement("i");
        pixel.className = `concierge-magic-pixel${index === 0 ? " is-leading" : ""}`;
        const size = index === 0 ? 5 : index < 8 ? 3.5 : 2.5;
        pixel.style.width = pixel.style.height = `${size}px`;
        field.append(pixel);
        const frames = Array.from({ length: 17 }, (_, sample) => {
          const progress = sample / 16;
          const point = pointOnAttentionRoute(route, progress);
          return {
            transform: `translate3d(${point.x - size / 2}px,${point.y - size / 2}px,0) scale(${progress > 0.9 ? 1 - (progress - 0.9) * 7 : 1})`,
            opacity:
              sample === 0 || sample === 16
                ? 0
                : index === 0
                  ? 1
                  : 0.94 - index * 0.016,
            offset: progress,
          };
        });
        animations.push(
          pixel.animate(frames, {
            duration: PARTICLE_FLIGHT_MS,
            delay: index * PARTICLE_STAGGER_MS,
            easing: "cubic-bezier(.28,.08,.25,1)",
            fill: "both",
          }),
        );
      }
      // Geometry reads are bounded to this short flight, rather than a
      // permanent animation-frame loop. Layout shifts cannot leave a detached
      // trail travelling to the bubble's former position.
      const guardGeometry = () => {
        track();
        if (!finished && field) after(guardGeometry, 96);
      };
      after(guardGeometry, 96);
      after(() => {
        track();
        if (finished) return;
        phase("arrival");
        bubble.classList.add("has-attention-arrival");
        after(() => {
          bubble?.classList.remove("has-attention-arrival");
          field?.remove();
          field = null;
          halo?.remove();
          animations.forEach((animation) => animation.cancel());
          phase("settled");
          finished = true;
        }, ARRIVAL_PULSE_MS);
      }, PARTICLE_FLIGHT_MS - 70);
    }, ATTENTION_LAP_MS);
    const onGeometry = () => {
      if (!finished) track();
    };
    const onMotionChange = () => {
      if (motion.matches) settle();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") settle();
    };
    window.addEventListener("scroll", onGeometry, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", onGeometry);
    motion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      finished = false;
      settle();
      unsubscribe?.();
      window.removeEventListener("scroll", onGeometry, true);
      window.removeEventListener("resize", onGeometry);
      motion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibility);
      if (aside.dataset.attentionToken === token) {
        delete aside.dataset.attentionPhase;
        delete aside.dataset.attentionToken;
      }
    };
  }, [attention?.token, active]);
}
