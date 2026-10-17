import { useLayoutEffect, useRef, useState } from "react";
import { findBlankPlacement } from "./bubble-motion.js";

const blankContent =
  ".product-visual,.product-info,.product-bottom,.outfit-components,.case-switch-button,.edit-card,.detail-visual,.detail-info > :not(.product-concierge-slot),.modal-head,.shop-intro-copy > *,.shop-intro-visual,.filter-bar,.filter-context,.section-heading,.scene-availability,.feed-end,.mobile-nav,.floating-tools button,.visit-page button";

export function useConciergePlacement({
  active,
  asideRef,
  composerRef,
  inputRef,
  avoidPageControls,
  productMode = false,
  held,
  revision,
}) {
  const [yielding, setYielding] = useState(false);
  const inspectedAt = useRef(-Infinity);
  const wasActive = useRef(false);
  useLayoutEffect(() => {
    if (
      active &&
      !wasActive.current &&
      document.querySelector(".modal[data-concierge-current-product]")
    ) {
      inspectedAt.current = performance.now();
      setYielding(true);
    }
    wasActive.current = active;
  }, [active]);
  const state = useRef({ held, yielding });
  state.current = { held, yielding };
  useLayoutEffect(() => {
    if (!active) return;
    let frame;
    const place = () => {
      frame = null;
      const aside = asideRef.current,
        composer = composerRef.current;
      if (!aside || !composer) return;
      const width = innerWidth,
        height = innerHeight;
      const composerBox = composer.getBoundingClientRect();
      const headerBottom = Math.max(
        0,
        document.querySelector(".site-header")?.getBoundingClientRect()
          .bottom || 0,
      );
      const sheet = document.querySelector(
        ".modal[data-concierge-current-product]",
      );
      if (productMode && sheet) {
        // The product sheet reserves a dedicated rail; never fade or float
        // the guide over the image, variants or store-list actions.
        for (const key of ["top", "bottom", "left", "right"])
          aside.style[key] = "";
        composer.style.top = "";
        aside.dataset.yieldPlacement = "product-rail";
        aside.style.setProperty(
          "--subtitle-available-height",
          width < 900 ? "130px" : `${Math.max(140, height - 270)}px`,
        );
        return;
      }
      const margin = width < 600 ? 14 : 20;
      const composerTop = Math.round(
        Math.min(
          height * (width < 600 ? 0.81 : 0.8),
          height - (width < 600 ? 83 : 30) - composerBox.height,
        ),
      );
      // A focused input keeps its position while typing. The fixed input has
      // its own centerline and never follows the yielding reading surface.
      if (document.activeElement !== inputRef.current)
        composer.style.top = `${composerTop}px`;
      const actualComposerTop = parseFloat(composer.style.top) || composerTop;
      const asideBox = aside.getBoundingClientRect();
      const preferred = {
        left: (width - asideBox.width) / 2,
        top: Math.max(12, actualComposerTop - asideBox.height - 12),
      };
      let destination = preferred;
      if (
        state.current.yielding &&
        !aside.classList.contains("is-history-expanded")
      ) {
        const obstacles = [...document.querySelectorAll(blankContent)]
          .filter(
            (el) =>
              !el.closest(".subtitle-concierge") &&
              (!sheet || sheet.contains(el)),
          )
          .map((el) => el.getBoundingClientRect())
          .filter(
            (r) =>
              r.width &&
              r.height &&
              r.bottom > 0 &&
              r.top < height &&
              r.right > 0 &&
              r.left < width,
          );
        obstacles.push(composerBox);
        const blank = findBlankPlacement({
          width,
          height,
          panelWidth: asideBox.width,
          panelHeight: asideBox.height,
          obstacles,
          preferred,
          top: sheet ? 12 : Math.max(12, headerBottom + 10),
          bottom: height - (width < 600 ? 78 : 12),
          margin,
        });
        if (blank) {
          destination = blank;
          aside.dataset.yieldPlacement = "blank";
        } else {
          // Short viewports can have no rectangle large enough for the whole
          // stack. Its compact sheet-reserved band stays clear of the image.
          const sheetBottom = sheet?.getBoundingClientRect().bottom;
          destination = {
            ...preferred,
            top: Math.max(
              preferred.top,
              sheetBottom ? sheetBottom + 10 : preferred.top,
            ),
          };
          destination.top = Math.min(
            destination.top,
            height - asideBox.height - (width < 600 ? 82 : 12),
          );
          aside.dataset.yieldPlacement = "compact";
        }
      } else delete aside.dataset.yieldPlacement;
      const stackChrome = Math.max(
        0,
        asideBox.height -
          (aside.querySelector(".subtitle-bubbles")?.getBoundingClientRect()
            .height || 0),
      );
      const available = Math.max(
        70,
        actualComposerTop - Math.max(16, headerBottom + 10) - stackChrome - 12,
      );
      Object.assign(aside.style, {
        top: "auto",
        left: `${Math.round(destination.left)}px`,
        right: "auto",
        bottom: `${Math.round(height - destination.top - asideBox.height)}px`,
      });
      aside.style.setProperty("--subtitle-available-height", `${available}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    const inspectProduct = (event) => {
      if (
        event.type !== "maison:product-inspect" &&
        (!(event.target instanceof Element) ||
          !event.target.closest(
            ".product-image-button,.product-name,.scene-swap-button,[data-outfit-product],.bubble-piece,.bubble-owned-reference button",
          ))
      )
        return;
      inspectedAt.current = performance.now();
      setYielding(true);
      schedule();
    };
    const resumeCenter = (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".subtitle-concierge")
      )
        return;
      // Opening/focusing the sheet can produce native layout scrolls. They
      // are not the shopper choosing to return to normal reading. A real wheel,
      // touch or navigation key still restores immediately.
      if (
        event?.type === "scroll" &&
        event.isTrusted &&
        performance.now() - inspectedAt.current < 700
      ) {
        schedule();
        return;
      }
      setYielding(false);
      schedule();
    };
    const resize = new ResizeObserver(schedule);
    if (asideRef.current) resize.observe(asideRef.current);
    if (composerRef.current) resize.observe(composerRef.current);
    const productSheet = document.querySelector(
      ".modal[data-concierge-current-product]",
    );
    if (productSheet) resize.observe(productSheet);
    const productVisual = productSheet?.querySelector(".detail-visual");
    if (productVisual) resize.observe(productVisual);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", inspectProduct, true);
    window.addEventListener("maison:product-inspect", inspectProduct);
    window.addEventListener("scroll", resumeCenter, {
      passive: true,
      capture: true,
    });
    window.addEventListener("wheel", resumeCenter, {
      passive: true,
      capture: true,
    });
    window.addEventListener("touchmove", resumeCenter, {
      passive: true,
      capture: true,
    });
    const navigationKey = (event) => {
      if (
        [
          "PageDown",
          "PageUp",
          "ArrowDown",
          "ArrowUp",
          "Home",
          "End",
          " ",
        ].includes(event.key) &&
        !event.target?.matches?.("input,textarea,select")
      )
        resumeCenter(event);
    };
    window.addEventListener("keydown", navigationKey);
    window.addEventListener("resize", schedule);
    place();
    // A product link can collapse expanded history and replace the sheet in
    // the same event. Measure again after those committed widths settle.
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      document.removeEventListener("click", inspectProduct, true);
      window.removeEventListener("maison:product-inspect", inspectProduct);
      window.removeEventListener("scroll", resumeCenter, true);
      window.removeEventListener("wheel", resumeCenter, true);
      window.removeEventListener("touchmove", resumeCenter, true);
      window.removeEventListener("keydown", navigationKey);
      window.removeEventListener("resize", schedule);
    };
  }, [active, avoidPageControls, productMode, revision, held, yielding]);
  return productMode ? false : yielding;
}
