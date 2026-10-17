import { useLayoutEffect, useRef, useState } from "react";
import { targetIsVisible } from "./concierge-visibility.js";
import {
  ATTENTION_SETTLE_MS,
  POINTER_INTENT_MS,
  attentionScore,
  targetIdentity,
  targetRect,
  targetVisual,
} from "./attention.js";

// React only owns changes of product identity. Moving the same frame with the
// page is a DOM/compositor update, never a render of the whole guide/catalog.
export function useCatalogAttention({
  enabled,
  contextKey,
  onChange,
  onSettle,
}) {
  const [attention, setAttention] = useState(null);
  const callbacks = useRef({ onChange, onSettle });
  callbacks.current = { onChange, onSettle };
  const serial = useRef(0);
  useLayoutEffect(() => {
    if (!enabled) {
      setAttention(null);
      return;
    }
    let current = null,
      settledTimer,
      pointerTimer,
      frame,
      disposed = false,
      pointerIntent = null;
    let candidates = [],
      targetsDirty = true;
    const listeners = new Set();
    const inView = new Set();
    const ignored = (target) =>
      target instanceof Element &&
      target.closest(".subtitle-concierge,.guide-chat,.guide-input");
    const interactive = () =>
      document.activeElement?.matches("input,textarea,select") ||
      document.querySelector(".subtitle-bubble:hover");
    const visible = (element) =>
      element?.isConnected &&
      !element.closest('[hidden],[aria-hidden="true"]') &&
      targetIsVisible(element) &&
      targetRect(element);
    const publishGeometry = (rect) => {
      if (!current) return;
      current.rect = rect;
      for (const listener of listeners) listener(rect);
    };
    const settle = (element, snapshot) => {
      if (
        settledTimer ||
        snapshot.settled ||
        !(
          element.dataset.conciergeProduct ||
          element.dataset.conciergeCurrentProduct
        )
      )
        return;
      const deliver = () => {
        settledTimer = null;
        const settledRect = visible(element);
        if (
          disposed ||
          current !== snapshot ||
          !settledRect ||
          !targetIsVisible(element) ||
          interactive() ||
          document.visibilityState !== "visible"
        )
          return;
        snapshot.settled = true;
        callbacks.current.onSettle({ ...snapshot, rect: settledRect });
      };
      // Content is ready in the first visible frame. The contour and particle
      // handoff are decoration, never a queue in front of readable guidance.
      if (ATTENTION_SETTLE_MS === 0) deliver();
      else settledTimer = setTimeout(deliver, ATTENTION_SETTLE_MS);
    };
    const choose = (element, kind = "viewport", measuredRect) => {
      if (disposed) return;
      const rect = measuredRect || visible(element);
      if (!rect) element = null;
      const key = targetIdentity(element);
      if (key === current?.key) {
        publishGeometry(rect);
        if (current && element) settle(element, current);
        return;
      }
      clearTimeout(settledTimer);
      settledTimer = null;
      current?.element.classList.remove("concierge-attention-current");
      current = element
        ? {
            element,
            key,
            kind,
            token: ++serial.current,
            rect,
            subscribe(listener) {
              listeners.add(listener);
              return () => listeners.delete(listener);
            },
          }
        : null;
      listeners.clear();
      if (current) element.classList.add("concierge-attention-current");
      setAttention(current);
      callbacks.current.onChange(current);
      if (!current) return;
      settle(element, current);
    };
    const scan = () => {
      frame = null;
      if (interactive()) {
        if (current)
          choose(
            visible(current.element) ? current.element : null,
            current.kind,
          );
        return;
      }
      const sheet = document.querySelector(
        ".modal[data-concierge-current-product]",
      );
      if (sheet) {
        choose(sheet, "product_view");
        return;
      }
      // A deliberate pointer hover supersedes a formerly focused button.
      // React/observer updates must not hand attention back to stale focus.
      if (pointerIntent) {
        if (visible(pointerIntent)) {
          choose(pointerIntent, "pointer");
          return;
        }
        pointerIntent = null;
      }
      const focused = document.activeElement?.closest(
        "[data-concierge-product]",
      );
      if (focused && visible(focused)) {
        choose(focused, "focus");
        return;
      }
      if (targetsDirty) {
        candidates = [...document.querySelectorAll("[data-concierge-product]")];
        targetsDirty = false;
      }
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const header = Math.max(
        0,
        document.querySelector(".site-header")?.getBoundingClientRect()
          .bottom || 0,
      );
      let best = null,
        bestScore = -Infinity,
        currentScore = -Infinity;
      const nextInView = new Set();
      // One read per candidate; entry-cue writes follow all geometry reads.
      for (const element of candidates) {
        if (
          !element.isConnected ||
          element.closest('[hidden],[aria-hidden="true"]')
        )
          continue;
        const rect = targetVisual(element).getBoundingClientRect();
        const score = attentionScore(rect, viewport, header);
        if (Number.isFinite(score)) nextInView.add(element);
        if (element === current?.element) currentScore = score;
        if (score > bestScore) {
          best = element;
          bestScore = score;
        }
      }
      // Every newly visible image gives a quick local acknowledgement; only
      // the strongest target owns the one readable companion bubble.
      for (const element of inView) {
        if (!nextInView.has(element)) {
          element.classList.remove("concierge-just-visible");
          inView.delete(element);
        }
      }
      for (const element of nextInView) {
        if (!inView.has(element)) {
          element.classList.add("concierge-just-visible");
          inView.add(element);
        }
      }
      // A tiny score margin prevents two near-equal cards flickering at a seam.
      if (
        current?.kind === "viewport" &&
        Number.isFinite(currentScore) &&
        currentScore >= bestScore - 0.025
      )
        best = current.element;
      choose(best);
    };
    const scheduleScan = (event) => {
      if (event?.type === "scroll") {
        clearTimeout(pointerTimer);
        pointerIntent = null;
      }
      if (!frame) frame = requestAnimationFrame(scan);
    };
    const fromEvent = (event) =>
      event.target instanceof Element
        ? event.target.closest(
            "[data-concierge-product],[data-concierge-current-product],[data-concierge-section]",
          )
        : null;
    const pointer = (event) => {
      clearTimeout(pointerTimer);
      if (
        ignored(event.target) ||
        event.pointerType === "touch" ||
        interactive()
      )
        return;
      const element = fromEvent(event);
      if (!element) pointerIntent = null;
      if (
        element &&
        (targetIdentity(element) !== current?.key ||
          current?.kind !== "pointer")
      )
        pointerTimer = setTimeout(() => {
          // Auto-scroll can follow pointermove. Recheck the physical hit so
          // a passed occurrence cannot claim an old hover after scrolling.
          const hit = document.elementFromPoint(event.clientX, event.clientY);
          if (fromEvent({ target: hit }) !== element) return;
          pointerIntent = element;
          choose(element, "pointer");
        }, POINTER_INTENT_MS);
    };
    const deliberate = (event) => {
      if (!ignored(event.target)) {
        clearTimeout(pointerTimer);
        pointerIntent = null;
        const element = fromEvent(event);
        if (element)
          choose(element, event.type === "focusin" ? "focus" : "click");
      }
    };
    const hidden = () =>
      document.visibilityState !== "visible" ? choose(null) : scheduleScan();
    document.addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("pointerdown", deliberate, { passive: true });
    document.addEventListener("focusin", deliberate);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("scroll", scheduleScan, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", scheduleScan);
    const observer = new MutationObserver(() => {
      targetsDirty = true;
      scheduleScan();
    });
    const main = document.getElementById("main");
    if (main) observer.observe(main, { childList: true, subtree: true });
    scan();
    return () => {
      disposed = true;
      clearTimeout(settledTimer);
      clearTimeout(pointerTimer);
      cancelAnimationFrame(frame);
      listeners.clear();
      current?.element.classList.remove("concierge-attention-current");
      for (const element of inView)
        element.classList.remove("concierge-just-visible");
      observer.disconnect();
      document.removeEventListener("pointermove", pointer);
      document.removeEventListener("pointerdown", deliberate);
      document.removeEventListener("focusin", deliberate);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("scroll", scheduleScan, true);
      window.removeEventListener("resize", scheduleScan);
    };
  }, [enabled, contextKey]);
  return attention;
}
