import React, { useEffect, useRef, useState } from "react";
import { byId, buildFeed } from "./data.js";
import { curatedScenarioFor } from "./personalized-scenes.js";
import {
  SCENE_SWAP_TUTORIAL_EVENT,
  sceneSwapTutorialStatus,
  resetSceneSwapTutorial,
  dismissSceneSwapTutorial,
} from "./PersonalizedScene.jsx";
import { getPersonaPreset } from "./presets.js";
import useEightProductJourney, {
  resetEightProductJourney,
} from "./useEightProductJourney.jsx";
import {
  GUIDED_RESET_EVENT,
  JOURNEY_STORAGE_PREFIX,
  guidanceInteractionBlocked,
} from "./guided-journey.js";
import "./guided-journey.css";
import useRequiredGuideLock from "./useRequiredGuideLock.jsx";

const statusKey = (id) => `maison-edit-guided-case:${id}`;
const read = (key, storage = sessionStorage) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value, storage = sessionStorage) => {
  try {
    storage.setItem(key, value);
  } catch {}
};
export function restartGuidedCase(id, { resetSwapTutorial = false } = {}) {
  // Returning to a case preserves deliberate exits and completion. Only an
  // explicit replay resets its lessons and its eight-piece browsing counter.
  if (resetSwapTutorial) {
    try {
      sessionStorage.removeItem(statusKey(id));
    } catch {}
    resetSceneSwapTutorial(id);
    resetEightProductJourney(id);
    window.dispatchEvent(
      new CustomEvent(GUIDED_RESET_EVENT, { detail: { caseId: id } }),
    );
  }
}
export function resetAllGuidedCases() {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (
        key?.startsWith("maison-edit-guided-case:") ||
        key?.startsWith(JOURNEY_STORAGE_PREFIX)
      )
        sessionStorage.removeItem(key);
    }
  } catch {}
  resetSceneSwapTutorial();
  window.dispatchEvent(new CustomEvent(GUIDED_RESET_EVENT));
}

export default function GuidedDemo({
  active,
  browsing = true,
  suspended = false,
  state,
  modal,
  L,
  onProduct,
  onCloseProduct,
}) {
  const scenario = curatedScenarioFor(state.profile);
  const caseId =
    scenario?.id ||
    `${state.profile.personaId}:${state.profile.homeId}:${state.profile.room}`;
  const department = getPersonaPreset(state.profile.personaId).category;
  const [sku] = useState(() => {
    const offered = buildFeed({}, state.profile, state.feedback)
      .filter((entry) => entry.type === "product")
      .map((entry) => entry.product);
    return (
      offered.find(
        (item) =>
          item.category === department &&
          !state.cart.some((line) => line.skuId === item.id) &&
          state.inventory[item.id] > 0,
      )?.id ||
      offered.find(
        (item) => item.category === department && state.inventory[item.id] > 0,
      )?.id
    );
  });
  const [step, setStep] = useState(() =>
    read(statusKey(caseId)) || sceneSwapTutorialStatus(caseId) === "dismissed"
      ? "off"
      : sceneSwapTutorialStatus(caseId) === "swapped"
        ? "invite"
        : "intro",
  );
  const [rect, setRect] = useState(null);
  const [target, setTarget] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [visitSeen, setVisitSeen] = useState(false);
  const panelRef = useRef(null);
  const [live, setLive] = useState("");
  const targetRef = useRef(null);
  const [interactionBlocked, setInteractionBlocked] = useState(false);
  const item = byId(sku);
  const done = step === "done",
    off = step === "off";
  const exit = () => {
    if (journey.status !== "completed") journey.cancel();
    if (!sceneSwapTutorialStatus(caseId)) dismissSceneSwapTutorial(caseId);
    write(statusKey(caseId), done ? "completed" : "exited");
    setStep("off");
    setRect(null);
  };
  const finish = () => {
    journey.complete();
    if (!sceneSwapTutorialStatus(caseId)) dismissSceneSwapTutorial(caseId);
    write(statusKey(caseId), "completed");
    setStep("done");
    setRect(null);
  };
  const journey = useEightProductJourney({
    active,
    browsing,
    caseId: caseId,
    enabled: !off && !done,
    safe: !modal && !suspended && !["try-list", "review"].includes(step),
    onArrive: (button) => {
      targetRef.current = button;
      setTarget(button);
      setVisitSeen(true);
      setStep("visit");
      setLive(
        L(
          "已浏览八款不同单品。请亲自点击「规划到店之旅」。",
          "You’ve explored eight different pieces. Select Plan your visit to continue.",
        ),
      );
      button.focus({ preventScroll: true });
    },
    onExit: () => {
      if (!sceneSwapTutorialStatus(caseId)) dismissSceneSwapTutorial(caseId);
      write(statusKey(caseId), "exited");
      setStep("off");
      setRect(null);
    },
  });
  useEffect(() => {
    const reset = (event) => {
      if (event.detail?.caseId && event.detail.caseId !== caseId) return;
      setStep("intro");
      setRect(null);
      setVisitSeen(false);
      setTarget(null);
      targetRef.current = null;
    };
    window.addEventListener(GUIDED_RESET_EVENT, reset);
    return () => window.removeEventListener(GUIDED_RESET_EVENT, reset);
  }, [caseId]);
  useEffect(() => {
    const scan = () =>
      setInteractionBlocked(
        guidanceInteractionBlocked({ allowGuidedMask: true }),
      );
    const timer = setInterval(scan, 150);
    scan();
    document.addEventListener("input", scan, true);
    document.addEventListener("focusin", scan, true);
    document.addEventListener("focusout", scan, true);
    return () => {
      clearInterval(timer);
      document.removeEventListener("input", scan, true);
      document.removeEventListener("focusin", scan, true);
      document.removeEventListener("focusout", scan, true);
    };
  }, []);
  const paused = Boolean(
    suspended || (interactionBlocked && step !== "review"),
  );
  useRequiredGuideLock({
    active:
      active &&
      !paused &&
      !modal &&
      step === "visit" &&
      visitSeen &&
      journey.phase !== "traveling",
    target: () => targetRef.current,
    panel: () => panelRef.current,
    onExit: exit,
  });
  const allAdded =
    item &&
    state.cart.some((line) => line.skuId === item.id) &&
    step === "try-list";

  useEffect(() => {
    if (!active || step !== "intro") return;
    const taught = (event) => {
      if (event.detail?.caseId !== caseId) return;
      if (event.detail.action === "swapped") setStep("invite");
      else if (event.detail.action === "dismissed") exit();
    };
    window.addEventListener(SCENE_SWAP_TUTORIAL_EVENT, taught);
    return () => window.removeEventListener(SCENE_SWAP_TUTORIAL_EVENT, taught);
  }, [active, step, caseId]);
  useEffect(() => {
    if (!active || off || paused) return;
    const onKey = (event) => {
      if (event.key === "Escape") {
        // Independent conversation surfaces own their keyboard behavior. An
        // offscreen lesson must never consume a page or composer Escape.
        if (
          event.target instanceof Element &&
          event.target.closest(
            ".subtitle-concierge, .subtitle-composer, .guide-chat, .guide-input",
          )
        )
          return;
        // The actual scene owns its lesson's Escape and restores focus to
        // its thumbnail. The document-level tour never consumes intro keys.
        if (step === "intro" || (step === "visit" && visitSeen)) return;
        event.preventDefault();
        event.stopPropagation();
        exit();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [active, off, step, paused, visitSeen]);

  useEffect(() => {
    if (
      !active ||
      paused ||
      journey.phase === "traveling" ||
      off ||
      step === "intro" ||
      step === "invite" ||
      done ||
      (modal && step !== "review")
    )
      return;
    let stopped = false,
      raf,
      settleTimer,
      observer;
    const selector =
      step === "try-list"
        ? `[data-concierge-product="${sku}"] [data-tour-action="try-list"]`
        : step === "review"
          ? `.product-detail [data-tour-action="review-list"][data-tour-sku="${sku}"]`
          : '[data-tour-action="plan-visit"]';
    const measure = () => {
      raf = null;
      if (stopped) return;
      const found =
        step === "visit" && journey.destination?.isConnected
          ? journey.destination
          : [...document.querySelectorAll(selector)].find((el) => {
              if (!el.getClientRects().length) return false;
              if (step !== "visit") return true;
              const bounds = el.getBoundingClientRect();
              return bounds.top >= 70 && bounds.bottom <= innerHeight;
            });
      if (!found) {
        setRect(null);
        setWaiting(true);
        return;
      }
      targetRef.current = found;
      setTarget(found);
      setWaiting(false);
      const r = found.getBoundingClientRect();
      if (step === "visit" && !visitSeen) {
        if (r.top < innerHeight * 0.9 && r.bottom > 80) setVisitSeen(true);
        else {
          setRect(null);
          return;
        }
      }
      const next = {
        top: Math.max(0, r.top - 7),
        left: Math.max(0, r.left - 7),
        right: Math.min(innerWidth, r.right + 7),
        bottom: Math.min(innerHeight, r.bottom + 7),
        width: Math.min(innerWidth, r.right + 7) - Math.max(0, r.left - 7),
        height: Math.min(innerHeight, r.bottom + 7) - Math.max(0, r.top - 7),
      };
      if (step === "review") {
        const info = found.closest(".detail-info")?.getBoundingClientRect();
        if (info)
          next.allow = {
            top: Math.max(0, info.top),
            left: Math.max(0, info.left),
            right: Math.min(innerWidth, info.right),
            bottom: Math.min(innerHeight, info.bottom),
            width: Math.min(innerWidth, info.right) - Math.max(0, info.left),
            height: Math.min(innerHeight, info.bottom) - Math.max(0, info.top),
          };
      }
      setRect(next);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", schedule);
    settleTimer = setTimeout(
      () => {
        const found = document.querySelector(selector);
        if (found && step !== "visit") {
          found.scrollIntoView({
            block: "center",
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "auto"
              : "smooth",
          });
          found.focus({ preventScroll: true });
        }
        schedule();
      },
      step === "review" ? 220 : 450,
    );
    schedule();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
      observer.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [
    active,
    step,
    modal,
    sku,
    visitSeen,
    paused,
    journey.phase,
    journey.destination,
  ]);

  useEffect(() => {
    if (
      !active ||
      paused ||
      off ||
      done ||
      step === "intro" ||
      step === "invite"
    )
      return;
    const click = (event) => {
      if (!event.isTrusted) return;
      const action = event.target.closest("[data-tour-action]");
      if (!action || (step === "visit" && !visitSeen)) return;
      if (
        step === "try-list" &&
        action.dataset.tourAction === "try-list" &&
        action.dataset.tourSku === sku
      ) {
        // React submits the shopper's actual try-list action; the tour only follows it.
        setTimeout(() => {
          setLive(
            L(
              "已加入到店试穿清单，并提交演示备货。下一步，核对自动匹配尺码。",
              "Added to your store list and submitted for demo preparation. Next, review the automatically matched size.",
            ),
          );
          setStep("review");
          onProduct(sku);
        }, 0);
      } else if (
        step === "review" &&
        action.dataset.tourAction === "review-list" &&
        action.dataset.tourSku === sku &&
        !action.disabled
      ) {
        setTimeout(() => {
          setStep("visit");
          setLive(
            L(
              "已核对匹配信息，没有重复加入。继续浏览，看到规划到店之旅时再点击。",
              "Matched details reviewed, with no duplicate added. Continue browsing and select Plan your visit when you reach it.",
            ),
          );
          onCloseProduct();
        }, 0);
      } else if (
        step === "visit" &&
        action.dataset.tourAction === "plan-visit" &&
        action === targetRef.current
      )
        finish();
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [
    active,
    step,
    sku,
    off,
    done,
    visitSeen,
    L,
    onProduct,
    onCloseProduct,
    paused,
  ]);

  if (!active || off || !item || paused) return null;
  if (journey.phase === "traveling")
    return (
      <section
        className="guided-journey-travel"
        role="status"
        aria-live="polite"
      >
        <span>
          {L(
            "八款发现，连成一次到店。",
            "Eight discoveries, one considered visit.",
          )}
        </span>
        <button type="button" onClick={exit}>
          {L("退出引导 · Esc", "Exit guide · Esc")}
        </button>
      </section>
    );
  // The first lesson is attached to the real, visible scene component. It
  // focuses its real inset and never scrolls to a detached demonstration.
  if (step === "intro") return null;
  const inviting = step === "invite";
  const stepNumber = step === "try-list" ? 1 : step === "review" ? 2 : 3;
  const aperture = rect?.allow || rect;
  const panelWidth = Math.min(305, innerWidth - 36),
    panelHeight = panelRef.current?.offsetHeight || 190;
  const baseTop = innerHeight - (innerWidth < 900 ? 135 : 88) - panelHeight;
  let panelTop = baseTop,
    panelLeft = innerWidth < 600 ? 18 : 24;
  if (
    rect &&
    rect.right > panelLeft &&
    rect.left < panelLeft + panelWidth &&
    rect.bottom > baseTop &&
    rect.top < baseTop + panelHeight
  ) {
    if (innerWidth > 700) panelLeft = innerWidth - panelWidth - 24;
    else
      panelTop =
        rect.top - panelHeight - 22 > 75
          ? rect.top - panelHeight - 22
          : Math.min(innerHeight - panelHeight - 82, rect.bottom + 22);
  }
  const blocking = Boolean(
    rect && !done && !inviting && (step !== "visit" || visitSeen),
  );
  return (
    <>
      {blocking && (
        <div className="guided-click-mask" aria-hidden="true">
          <div style={{ inset: `0 0 auto 0`, height: aperture.top }} />
          <div
            style={{
              top: aperture.top,
              left: 0,
              width: aperture.left,
              height: aperture.height,
            }}
          />
          <div
            style={{
              top: aperture.top,
              left: aperture.right,
              right: 0,
              height: aperture.height,
            }}
          />
          <div style={{ top: aperture.bottom, bottom: 0, left: 0, right: 0 }} />
          <span
            className="guided-target-ring"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
        </div>
      )}
      <section
        ref={panelRef}
        className={`guided-demo-panel ${done ? "is-complete" : ""}`}
        data-guided-step={step}
        data-guided-sku={sku}
        data-viewed-products={journey.count}
        data-journey-phase={journey.phase}
        aria-label={L("演示体验引导", "Demo experience guide")}
        style={{ top: Math.max(20, panelTop), left: panelLeft, bottom: "auto" }}
      >
        <div>
          <span className="eyebrow">
            {inviting
              ? L("继续探索", "KEEP EXPLORING")
              : done
                ? L("体验完成", "EXPERIENCE COMPLETE")
                : `${L("体验引导", "GUIDED DEMO")} · ${stepNumber}/3`}
          </span>
          <button
            type="button"
            onClick={exit}
            aria-label={L("退出引导", "Exit guide")}
          >
            ×
          </button>
        </div>
        <h3>
          {inviting
            ? L("再试 3 个到店步骤？", "Try three steps toward a visit?")
            : done
              ? L(
                  "你的到店编选，已串联起来。",
                  "Your considered visit comes together.",
                )
              : step === "try-list"
                ? L("加入到店试穿清单。", "Add to your store try-on list.")
                : step === "review"
                  ? L("核对自动匹配与备货。", "Review your automatic match.")
                  : L(
                      "继续浏览，规划一次到店。",
                      "Keep exploring, then plan your visit.",
                    )}
        </h3>
        <p>
          {inviting
            ? L(
                "也可先自由浏览。看过八款不同单品后，将带你来到「规划到店之旅」。所有操作都由你亲自点击，可随时退出。",
                "Or browse at your own pace. After eight different pieces, you’ll reach Plan your visit. Every action needs your click; leave at any time.",
              )
            : done
              ? L(
                  "你的到店清单、匹配信息与演示备货已联动。这些都是本地数据，不会产生真实预留、预约或订单。",
                  "Your store list, matched details and demo preparation are linked. This local demo creates no real reservation, booking or order.",
                )
              : step === "try-list"
                ? L(
                    "请点击高亮的「加入到店试穿清单」。系统会匹配所选虚构人物模板，并提交演示备货。",
                    "Click Add to store try-on. The selected fictional template supplies the size, and a demo preparation request is submitted.",
                  )
                : step === "review"
                  ? L(
                      "无需再选尺码。看过自动匹配和待门店确认的状态后，点击高亮的核对按钮；不会再加一件。",
                      "No size selection is needed. Review the automatic match and pending store confirmation, then click the highlighted review button. No duplicate is added.",
                    )
                  : visitSeen
                    ? L(
                        "请点击高亮的「规划到店之旅」，查看演示预约。",
                        "Click the highlighted Plan your visit button to open demo planning.",
                      )
                    : L(
                        "向下浏览到「规划到店之旅」，我会在它出现时提示你点击。现在可以自由滚动。",
                        "Scroll down to Plan your visit. I’ll highlight its button when it appears. You can browse freely until then.",
                      )}
        </p>
        {inviting && (
          <button
            type="button"
            className="text-link"
            onClick={() => setStep("try-list")}
          >
            {L("开始 3 步体验", "Start the three-step tour")}
          </button>
        )}
        {allAdded && (
          <button
            className="text-link"
            onClick={() => {
              setStep("review");
              onProduct(sku);
            }}
          >
            {L(
              "已在到店清单，核对匹配信息",
              "Already listed, review matched details",
            )}
          </button>
        )}
        {done ? (
          <button className="text-link" onClick={exit}>
            {L("继续体验", "Continue exploring")}
          </button>
        ) : (
          <button className="guided-exit" type="button" onClick={exit}>
            {L("退出引导 · Esc", "Exit guide · Esc")}
          </button>
        )}
        <span className="scene-sr-status" role="status">
          {live}
        </span>
      </section>
    </>
  );
}
