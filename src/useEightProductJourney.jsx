import { useEffect, useRef, useState } from "react";
import {
  GUIDED_RESET_EVENT,
  JOURNEY_PRODUCT_COUNT,
  JOURNEY_PROGRESS_EVENT,
  JOURNEY_READY_EVENT,
  JOURNEY_RELEASE_EVENT,
  JOURNEY_REQUEST_EVENT,
  MEANINGFUL_VIEW_MS,
  guidanceInteractionBlocked,
  journeyEase,
  journeyKey,
  meaningfulProductRect,
  recordViewedProduct,
  restoreJourney,
} from "./guided-journey.js";

function readProgress(caseId) {
  try {
    return restoreJourney(sessionStorage.getItem(journeyKey(caseId)));
  } catch {
    return restoreJourney(null);
  }
}
export function resetEightProductJourney(caseId) {
  try {
    sessionStorage.removeItem(journeyKey(caseId));
  } catch {}
}

// Counts actual, settled exposure to distinct product images. Virtualized DOM,
// repeated SKUs, hidden cards, guide-driven movement and modal reading do not count.
export default function useEightProductJourney({
  active,
  browsing,
  caseId,
  enabled,
  safe,
  onArrive,
  onExit,
}) {
  const [progress, setProgress] = useState(() => readProgress(caseId));
  const [phase, setPhase] = useState("browsing");
  const [destination, setDestination] = useState(null);
  const current = useRef(progress);
  const callbacks = useRef({ onArrive, onExit });
  callbacks.current = { onArrive, onExit };
  const publish = (next) => {
    current.current = next;
    setProgress(next);
    try {
      sessionStorage.setItem(journeyKey(caseId), JSON.stringify(next));
    } catch {}
    window.dispatchEvent(
      new CustomEvent(JOURNEY_PROGRESS_EVENT, { detail: { caseId, ...next } }),
    );
  };
  const cancel = () => {
    publish({ ...current.current, status: "exited" });
    setPhase("exited");
    setDestination(null);
    window.dispatchEvent(new CustomEvent(JOURNEY_RELEASE_EVENT));
  };
  const complete = () => {
    publish({ ...current.current, status: "completed" });
    setPhase("completed");
    setDestination(null);
    window.dispatchEvent(new CustomEvent(JOURNEY_RELEASE_EVENT));
  };

  useEffect(() => {
    if (
      !active ||
      !browsing ||
      !enabled ||
      current.current.status !== "browsing"
    )
      return;
    const visibleSince = new Map();
    let movedAt = performance.now();
    const moved = () => {
      movedAt = performance.now();
    };
    const scan = () => {
      const now = performance.now();
      if (
        !safe ||
        guidanceInteractionBlocked() ||
        document.querySelector(".scene-swap-required-mask") ||
        now - movedAt < 110
      ) {
        visibleSince.clear();
        return;
      }
      const visible = new Set();
      const header = Math.max(
        0,
        document.querySelector(".site-header")?.getBoundingClientRect()
          .bottom || 0,
      );
      for (const card of document.querySelectorAll(
        ".endless-feed .product-card[data-concierge-product][data-feed-position]",
      )) {
        const sku = card.dataset.conciergeProduct;
        if (current.current.seen.includes(sku)) continue;
        const visual = card.querySelector(".product-visual") || card;
        const rect = visual.getBoundingClientRect();
        if (
          !meaningfulProductRect(
            rect,
            { width: innerWidth, height: innerHeight },
            header,
          )
        )
          continue;
        if (
          card.closest('[inert], [aria-hidden="true"]') ||
          !card.getClientRects().length
        )
          continue;
        const x = Math.max(
          1,
          Math.min(innerWidth - 1, rect.left + rect.width / 2),
        );
        const y = Math.max(
          header + 8,
          Math.min(
            innerHeight - 8,
            Math.max(rect.top, header) + Math.min(90, rect.height / 2),
          ),
        );
        const hit = document.elementFromPoint(x, y);
        if (!hit || !card.contains(hit)) continue;
        visible.add(sku);
        if (!visibleSince.has(sku)) visibleSince.set(sku, now);
        if (now - visibleSince.get(sku) < MEANINGFUL_VIEW_MS) continue;
        const next = recordViewedProduct(
          current.current,
          sku,
          Number(card.dataset.feedPosition),
        );
        if (next !== current.current) publish(next);
        visibleSince.delete(sku);
        if (next.status === "pending") break;
      }
      for (const sku of visibleSince.keys())
        if (!visible.has(sku)) visibleSince.delete(sku);
    };
    const interval = setInterval(scan, 100);
    window.addEventListener("scroll", moved, { passive: true });
    return () => {
      clearInterval(interval);
      window.removeEventListener("scroll", moved);
    };
  }, [active, browsing, enabled, safe, caseId, progress.status]);

  useEffect(() => {
    if (
      !active ||
      !browsing ||
      !enabled ||
      !safe ||
      progress.status !== "pending" ||
      !["browsing", "queued"].includes(phase)
    )
      return;
    let disposed = false;
    let requestedAt = -Infinity;
    const requestId = `${caseId}:${Date.now()}`;
    const ready = (event) => {
      if (disposed || event.detail?.requestId !== requestId) return;
      const button = event.detail.target;
      if (!button?.isConnected) return;
      setDestination(button);
      setPhase("traveling");
    };
    const begin = () => {
      if (
        performance.now() - requestedAt < 500 ||
        guidanceInteractionBlocked() ||
        document.querySelector(".scene-swap-required-mask")
      )
        return;
      requestedAt = performance.now();
      window.dispatchEvent(
        new CustomEvent(JOURNEY_REQUEST_EVENT, {
          detail: {
            requestId,
            caseId,
            afterPosition: current.current.afterPosition,
          },
        }),
      );
    };
    window.addEventListener(JOURNEY_READY_EVENT, ready);
    const interval = setInterval(begin, 150);
    begin();
    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener(JOURNEY_READY_EVENT, ready);
    };
  }, [active, browsing, enabled, safe, progress.status, phase, caseId]);

  useEffect(() => {
    if (!destination || phase !== "traveling") return;
    let frame;
    let disposed = false;
    let arrived = false;
    let stableSince = null;
    let lastGeometry = null;
    const start = scrollY;
    const started = performance.now();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const distance = Math.abs(
      destination.getBoundingClientRect().top - innerHeight * 0.43,
    );
    const duration = reduced
      ? 0
      : Math.max(1400, Math.min(2600, 1200 + distance * 0.065));
    const oldBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    document.documentElement.dataset.guidedTravel = "true";
    const release = () =>
      window.dispatchEvent(new CustomEvent(JOURNEY_RELEASE_EVENT));
    const interrupt = (event) => {
      if (
        event.type === "keydown" &&
        ![
          "Escape",
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        return;
      if (event.type === "keydown" && event.key === "Escape")
        event.preventDefault();
      cancel();
      callbacks.current.onExit?.();
    };
    const step = (now) => {
      if (disposed) return;
      if (!destination.isConnected) {
        setDestination(null);
        setPhase("queued");
        release();
        return;
      }
      if (!active || !browsing || !safe || guidanceInteractionBlocked()) {
        setDestination(null);
        setPhase("queued");
        release();
        return;
      }
      const p = duration ? Math.min(1, (now - started) / duration) : 1;
      const rect = destination.getBoundingClientRect();
      const target = Math.max(
        0,
        Math.min(
          document.documentElement.scrollHeight - innerHeight,
          scrollY + rect.top - innerHeight * 0.43,
        ),
      );
      window.scrollTo({
        top: start + (target - start) * journeyEase(p),
        behavior: "instant",
      });
      if (p < 1) frame = requestAnimationFrame(step);
      else {
        // Virtualized neighbors can change measured page heights after the
        // first jump. Dock against the live button until geometry is settled,
        // including reduced-motion mode, before exposing a mandatory spotlight.
        const finalRect = destination.getBoundingClientRect();
        const delta = finalRect.top - innerHeight * 0.43;
        const geometry = `${document.documentElement.scrollHeight}:${Math.round(finalRect.top + scrollY)}`;
        if (Math.abs(delta) > 1)
          window.scrollBy({ top: delta, behavior: "instant" });
        if (geometry !== lastGeometry || Math.abs(delta) > 1)
          stableSince = null;
        else if (stableSince === null) stableSince = now;
        lastGeometry = geometry;
        if (stableSince !== null && now - stableSince > 180) {
          arrived = true;
          setPhase("awaiting-click");
          callbacks.current.onArrive?.(destination);
        } else frame = requestAnimationFrame(step);
      }
    };
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("pointerdown", interrupt, { passive: true });
    document.addEventListener("keydown", interrupt, true);
    frame = requestAnimationFrame(step);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      document.documentElement.style.scrollBehavior = oldBehavior;
      delete document.documentElement.dataset.guidedTravel;
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("pointerdown", interrupt);
      document.removeEventListener("keydown", interrupt, true);
      if (!arrived) release();
    };
  }, [destination, phase, active, browsing, safe]);

  useEffect(() => {
    const reset = (event) => {
      if (event.detail?.caseId && event.detail.caseId !== caseId) return;
      const next = readProgress(caseId);
      current.current = next;
      setProgress(next);
      setPhase("browsing");
      setDestination(null);
      window.dispatchEvent(new CustomEvent(JOURNEY_RELEASE_EVENT));
    };
    window.addEventListener(GUIDED_RESET_EVENT, reset);
    return () => window.removeEventListener(GUIDED_RESET_EVENT, reset);
  }, [caseId]);

  // A case/view change always releases the pinned virtual page and animation.
  useEffect(
    () => () => window.dispatchEvent(new CustomEvent(JOURNEY_RELEASE_EVENT)),
    [caseId],
  );
  return {
    count: progress.seen.length,
    total: JOURNEY_PRODUCT_COUNT,
    status: progress.status,
    phase,
    destination,
    cancel,
    complete,
  };
}
