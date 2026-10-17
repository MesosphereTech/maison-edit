import { useEffect, useRef } from "react";
import { guidanceInteractionBlocked } from "./guided-journey.js";

// Only the real highlighted control and the explicit exit remain in this
// lesson's keyboard path. Escape exits; it never counts as completing a step.
export default function useRequiredGuideLock({
  active,
  target,
  panel,
  onExit,
}) {
  const current = useRef({ target, panel, onExit });
  current.current = { target, panel, onExit };
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const oldOverflow = root.style.overflow;
    const oldGutter = root.style.scrollbarGutter;
    const oldFocus = document.activeElement;
    root.style.scrollbarGutter = "stable";
    root.style.overflow = "hidden";
    const targetNode = () =>
      typeof current.current.target === "function"
        ? current.current.target()
        : current.current.target;
    const panelNode = () =>
      typeof current.current.panel === "function"
        ? current.current.panel()
        : current.current.panel;
    const controls = () =>
      [
        ...new Set([
          targetNode(),
          ...Array.from(
            panelNode()?.querySelectorAll('button, [href], [tabindex="0"]') ||
              [],
          ),
        ]),
      ].filter(
        (node) =>
          node?.isConnected && !node.disabled && node.getClientRects().length,
      );
    const key = (event) => {
      if (guidanceInteractionBlocked({ allowGuidedMask: true })) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        current.current.onExit?.();
      } else if (event.key === "Tab") {
        const list = controls();
        if (!list.length) return;
        const index = list.indexOf(document.activeElement);
        event.preventDefault();
        list[
          (index + (event.shiftKey ? -1 : 1) + list.length) % list.length
        ].focus({ preventScroll: true });
      } else if (
        ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(
          event.key,
        ) ||
        (event.key === " " && !controls().includes(event.target))
      ) {
        event.preventDefault();
      }
    };
    const prevent = (event) => {
      if (guidanceInteractionBlocked({ allowGuidedMask: true })) return;
      // Pinch/modified-wheel zoom is not progression through the lesson.
      if (event.ctrlKey || event.metaKey || event.touches?.length > 1) return;
      event.preventDefault();
    };
    const focus = (event) => {
      // An independently opened sheet or editor owns focus immediately, even
      // before the guide's next paused render has removed this listener.
      if (guidanceInteractionBlocked({ allowGuidedMask: true })) return;
      if (
        !controls().some(
          (node) => node === event.target || node.contains(event.target),
        )
      )
        targetNode()?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("focusin", focus, true);
    window.addEventListener("wheel", prevent, { passive: false });
    window.addEventListener("touchmove", prevent, { passive: false });
    targetNode()?.focus({ preventScroll: true });
    return () => {
      root.style.overflow = oldOverflow;
      root.style.scrollbarGutter = oldGutter;
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("focusin", focus, true);
      window.removeEventListener("wheel", prevent);
      window.removeEventListener("touchmove", prevent);
      if (
        oldFocus?.isConnected &&
        !oldFocus.closest(".guided-demo-panel") &&
        !guidanceInteractionBlocked({ allowGuidedMask: true })
      )
        oldFocus.focus?.({ preventScroll: true });
    };
  }, [active]);
}
