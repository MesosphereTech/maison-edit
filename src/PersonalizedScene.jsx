import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { guidanceInteractionBlocked } from "./guided-journey.js";
import useRequiredGuideLock from "./useRequiredGuideLock.jsx";
import { getHomePreset, getPersonaPreset } from "./presets.js";
import { outfitSceneFor } from "./outfit-scenes.js";
import {
  curatedScenarioFor,
  personalizedSceneFor,
} from "./personalized-scenes.js";
import "./personalized-scenes.css";
import { giftSceneContext } from "./gift-scenes.js";
import "./gift-scenes.css";

// A tab-scoped, per-case lesson belongs to a visible, usable thumbnail, never
// whichever lazy image happens to finish loading first. Only deliberate use or
// dismissal exits it; only a real swap completes this required first lesson.
const SWAP_TUTORIAL_PREFIX = "maison-edit-scene-swap-tutorial:v2:";
export const SCENE_SWAP_TUTORIAL_EVENT = "maison:scene-swap-tutorial";
const tutorialCandidates = new Map();
const tutorialOwners = new Map();
const tutorialStatuses = new Map();
let tutorialFrame = null;
let tutorialObserver = null;
let tutorialMutations = null;

export function sceneSwapTutorialStatus(caseId) {
  if (tutorialStatuses.has(caseId)) return tutorialStatuses.get(caseId);
  try {
    return sessionStorage.getItem(`${SWAP_TUTORIAL_PREFIX}${caseId}`);
  } catch {
    return null;
  }
}

export function resetSceneSwapTutorial(caseId) {
  const cases = caseId
    ? [caseId]
    : [
        ...new Set(
          [...tutorialStatuses.keys(), ...tutorialCandidates.values()].map(
            (entry) => (typeof entry === "string" ? entry : entry.caseId),
          ),
        ),
      ];
  if (!caseId) {
    try {
      for (let index = sessionStorage.length - 1; index >= 0; index--) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(SWAP_TUTORIAL_PREFIX))
          sessionStorage.removeItem(key);
      }
    } catch {}
  }
  for (const id of cases) {
    tutorialStatuses.delete(id);
    try {
      sessionStorage.removeItem(`${SWAP_TUTORIAL_PREFIX}${id}`);
    } catch {}
  }
  scheduleTutorialSelection();
}

export function dismissSceneSwapTutorial(caseId) {
  finishSceneSwapTutorial(caseId, "dismissed");
}

function finishSceneSwapTutorial(caseId, action) {
  tutorialStatuses.set(caseId, action);
  try {
    sessionStorage.setItem(`${SWAP_TUTORIAL_PREFIX}${caseId}`, action);
  } catch {}
  for (const candidate of tutorialCandidates.values()) {
    if (candidate.caseId === caseId) candidate.setActive(false);
  }
  tutorialOwners.delete(caseId);
  window.dispatchEvent(
    new CustomEvent(SCENE_SWAP_TUTORIAL_EVENT, {
      detail: { caseId, action },
    }),
  );
}

function scheduleTutorialSelection() {
  if (tutorialFrame !== null) return;
  tutorialFrame = requestAnimationFrame(() => {
    tutorialFrame = null;
    const eligible = new Map();
    for (const [node, candidate] of tutorialCandidates) {
      if (
        guidanceInteractionBlocked() ||
        sceneSwapTutorialStatus(candidate.caseId)
      )
        continue;
      const rect = node.getBoundingClientRect();
      const button = node.querySelector(".scene-swap-button");
      if (
        !button ||
        !node.getClientRects().length ||
        node.closest('[inert], [aria-hidden="true"]')
      )
        continue;
      const target = button.getBoundingClientRect();
      const visibleHeight =
        Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top);
      if (
        visibleHeight < Math.min(96, rect.height * 0.35) ||
        target.top < 0 ||
        target.top + Math.min(44, target.height) > innerHeight ||
        target.left < 0 ||
        target.right > innerWidth
      )
        continue;
      const hit = document.elementFromPoint(
        target.left + target.width / 2,
        Math.min(innerHeight - 4, target.top + target.height / 2),
      );
      if (hit?.closest(".scene-swap-button") !== button) continue;
      // A hidden, inert measurement copy keeps ownership stable even when an
      // independent concierge or floating control occupies the candidate rail.
      const lessonTargets = [
        node.querySelector(".scene-tutorial-copy"),
        node.querySelector(".scene-tutorial-dismiss"),
      ];
      const clearLesson = lessonTargets.every((element) => {
        if (!element) return false;
        const bounds = element.getBoundingClientRect();
        if (
          bounds.top < 0 ||
          bounds.bottom > innerHeight ||
          bounds.left < 0 ||
          bounds.right > innerWidth
        )
          return false;
        return [
          [bounds.left + 2, bounds.top + 2],
          [bounds.right - 2, bounds.top + 2],
          [bounds.left + 2, bounds.bottom - 2],
          [bounds.right - 2, bounds.bottom - 2],
          [bounds.left + bounds.width / 2, bounds.top + bounds.height / 2],
        ].every(([x, y]) => {
          const hit = document.elementFromPoint(x, y);
          if (hit?.closest(".personalized-scene") === node) return true;
          // The card's existing top-left action moves below the reserved rail
          // when this lesson activates; it is not an independent obstruction.
          return (
            !node.classList.contains("is-swap-tutorial") &&
            hit?.closest(".save-button")?.parentElement === node.parentElement
          );
        });
      });
      if (!clearLesson) continue;
      // Prefer reading order among currently visible, unoccluded targets.
      const previous = eligible.get(candidate.caseId);
      if (
        !previous ||
        rect.top < previous.rect.top ||
        (Math.abs(rect.top - previous.rect.top) < 2 &&
          rect.left < previous.rect.left)
      ) {
        eligible.set(candidate.caseId, { node, rect });
      }
    }
    for (const [node, candidate] of tutorialCandidates) {
      const active = eligible.get(candidate.caseId)?.node === node;
      candidate.setActive(active);
      if (active) tutorialOwners.set(candidate.caseId, node);
      else if (tutorialOwners.get(candidate.caseId) === node)
        tutorialOwners.delete(candidate.caseId);
    }
  });
}

function registerTutorial(node, caseId, setActive) {
  tutorialCandidates.set(node, { caseId, setActive });
  if (!tutorialObserver) {
    tutorialObserver = new IntersectionObserver(scheduleTutorialSelection, {
      threshold: [0, 0.25, 0.6, 1],
    });
    tutorialMutations = new MutationObserver(scheduleTutorialSelection);
    tutorialMutations.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "inert", "aria-hidden", "style", "class"],
    });
    window.addEventListener("scroll", scheduleTutorialSelection, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", scheduleTutorialSelection);
    document.addEventListener("visibilitychange", scheduleTutorialSelection);
    document.addEventListener("input", scheduleTutorialSelection, true);
    document.addEventListener("focusin", scheduleTutorialSelection, true);
    document.addEventListener("focusout", scheduleTutorialSelection, true);
  }
  tutorialObserver.observe(node);
  scheduleTutorialSelection();
  return () => {
    tutorialCandidates.delete(node);
    tutorialObserver?.unobserve(node);
    if (tutorialOwners.get(caseId) === node) tutorialOwners.delete(caseId);
    if (!tutorialCandidates.size) {
      tutorialObserver?.disconnect();
      tutorialMutations?.disconnect();
      tutorialObserver = null;
      tutorialMutations = null;
      cancelAnimationFrame(tutorialFrame);
      tutorialFrame = null;
      window.removeEventListener("scroll", scheduleTutorialSelection, true);
      window.removeEventListener("resize", scheduleTutorialSelection);
      document.removeEventListener(
        "visibilitychange",
        scheduleTutorialSelection,
      );
      document.removeEventListener("input", scheduleTutorialSelection, true);
      document.removeEventListener("focusin", scheduleTutorialSelection, true);
      document.removeEventListener("focusout", scheduleTutorialSelection, true);
    } else scheduleTutorialSelection();
  };
}

export default function PersonalizedScene({
  item,
  profile,
  L,
  onOpen,
  gift = null,
}) {
  const giftContext = giftSceneContext(item, profile, gift);
  const displayProfile = giftContext?.profile || profile;
  const outfit = outfitSceneFor(item.id, displayProfile, item.color);
  const scene = outfit
    ? { ...outfit, scenarioId: outfit.id, type: "outfit", color: item.color }
    : personalizedSceneFor(item.id, displayProfile, item.color);
  return (
    <SceneComparison
      key={`${item.id}:${item.color}:${scene?.src || "original"}:${item.image}`}
      item={item}
      profile={displayProfile}
      tutorialCase={
        curatedScenarioFor(profile)?.id ||
        `${profile.personaId}:${profile.homeId}:${profile.room}`
      }
      scene={scene}
      giftContext={giftContext}
      L={L}
      onOpen={onOpen}
    />
  );
}

function SceneComparison({
  item,
  profile,
  tutorialCase,
  scene,
  giftContext,
  L,
  onOpen,
}) {
  // An exact asset identity keeps an old image's load/error event from making a
  // newly selected person, room, SKU or colour look ready before it has loaded.
  const [loadedSource, setLoadedSource] = useState(null);
  const [failedSource, setFailedSource] = useState(null);
  const [failedOriginal, setFailedOriginal] = useState(null);
  const [loadedOriginal, setLoadedOriginal] = useState(false);
  const [hasSwapped, setHasSwapped] = useState(false);
  const [selection, setSelection] = useState(null);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialBounds, setTutorialBounds] = useState(null);
  const hostRef = useRef(null);
  const swapRef = useRef(null);
  const tutorialId = useId();
  const personalized = Boolean(
    scene &&
    loadedSource === scene.src &&
    failedSource !== scene.src &&
    loadedOriginal &&
    failedOriginal !== item.image,
  );
  useEffect(() => {
    if (!personalized || !hostRef.current) {
      setTutorialActive(false);
      return;
    }
    return registerTutorial(hostRef.current, tutorialCase, setTutorialActive);
  }, [personalized, tutorialCase]);
  useRequiredGuideLock({
    active: tutorialActive && personalized,
    target: () => swapRef.current,
    panel: () => hostRef.current?.querySelector(".scene-swap-tutorial"),
    onExit: () => dismissSceneSwapTutorial(tutorialCase),
  });
  useEffect(() => {
    if (!tutorialActive || !personalized) {
      setTutorialBounds(null);
      return;
    }
    const measure = () => {
      const button = swapRef.current?.getBoundingClientRect();
      const rail = hostRef.current
        ?.querySelector(".scene-swap-tutorial")
        ?.getBoundingClientRect();
      if (!button || !rail) return;
      setTutorialBounds({
        top: Math.max(0, Math.min(button.top, rail.top) - 7),
        left: Math.max(0, Math.min(button.left, rail.left) - 7),
        right: Math.min(innerWidth, Math.max(button.right, rail.right) + 7),
        bottom: Math.min(innerHeight, Math.max(button.bottom, rail.bottom) + 7),
        target: {
          top: button.top - 5,
          left: button.left - 5,
          width: button.width + 10,
          height: button.height + 10,
        },
      });
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [tutorialActive, personalized]);
  const originalLarge = personalized && selection === scene.src;
  const persona = getPersonaPreset(profile.personaId);
  const home = getHomePreset(profile.homeId);
  const originalSource =
    failedOriginal === item.image ? `/images/${item.kind}.svg` : item.image;
  const originalAlt = L(
    `${item.id} ${item.name}商品概念图`,
    `${item.id} ${item.en}, product concept image`,
  );
  const sceneAlt = scene
    ? (giftContext
        ? L(
            "模特展示：虚构成人模特，非顾客或受赠人。",
            "Model styling: a fictional adult model, not the shopper or recipient. ",
          )
        : "") +
      L(
        scene.type === "outfit"
          ? `AI 完整穿搭：${persona.zh} · ${scene.sceneZh}，含 ${scene.products.map((entry) => `${entry.skuId} ${entry.color}`).join("、")}。虚构搭配示意，非合身保证。`
          : scene.type === "wear"
            ? `AI 场景：${persona.zh}与${item.id} ${item.name}（${scene.color}）`
            : `AI 场景：${home.zh}客厅中的${item.id} ${item.name}（${scene.color}）`,
        scene.type === "outfit"
          ? `AI full outfit: ${persona.en}, ${scene.sceneEn}, with ${scene.products.map((entry) => `${entry.skuId} ${entry.color}`).join(", ")}. Synthetic styling concept, no fit guarantee.`
          : scene.type === "wear"
            ? `AI scene: ${persona.en} with ${item.id} ${item.en} in ${scene.color}`
            : `AI scene: ${item.id} ${item.en} in ${scene.color}, in the living room of ${home.en}`,
      )
    : "";
  const sceneLabel = giftContext
    ? L("模特展示", "MODEL STYLING")
    : L("AI 场景", "AI SCENE");
  const swapLabel = originalLarge
    ? giftContext
      ? L("将模特展示切换为大图", "Show model styling as the main image")
      : L("将 AI 场景切换为大图", "Show AI scene as the main image")
    : L("将商品图切换为大图", "Show product as the main image");

  return (
    <span
      ref={hostRef}
      className={`personalized-scene ${personalized ? "is-ready" : ""} ${originalLarge ? "is-original-large" : ""} ${hasSwapped ? "has-swapped" : ""} ${tutorialActive ? "is-swap-tutorial" : ""}`}
      onKeyDown={(event) => {
        if (tutorialActive && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          dismissSceneSwapTutorial(tutorialCase);
          swapRef.current?.focus({ preventScroll: true });
        }
      }}
      data-scene-product={item.id}
      data-scene-tutorial={tutorialActive ? "required" : undefined}
      data-gift-preview={giftContext ? "true" : undefined}
      data-scene-model={giftContext && personalized ? "fictional" : undefined}
      data-scene-id={personalized ? scene.scenarioId : undefined}
      data-scene-kind={personalized ? scene.type : undefined}
      data-scene-main={
        personalized && !originalLarge ? "personalized" : "original"
      }
    >
      {tutorialActive &&
        tutorialBounds &&
        createPortal(
          <div className="scene-swap-required-mask" aria-hidden="true">
            <div
              style={{ top: 0, left: 0, right: 0, height: tutorialBounds.top }}
            />
            <div
              style={{
                top: tutorialBounds.top,
                left: 0,
                width: tutorialBounds.left,
                height: tutorialBounds.bottom - tutorialBounds.top,
              }}
            />
            <div
              style={{
                top: tutorialBounds.top,
                left: tutorialBounds.right,
                right: 0,
                height: tutorialBounds.bottom - tutorialBounds.top,
              }}
            />
            <div
              style={{
                top: tutorialBounds.bottom,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
            <span
              className="scene-required-ring"
              style={tutorialBounds.target}
            />
          </div>,
          document.body,
        )}
      <span
        className={`scene-image-plane scene-original-plane ${personalized && !originalLarge ? "is-inset" : "is-main"}`}
      >
        <img
          className="scene-original"
          src={originalSource}
          alt={originalAlt}
          loading="lazy"
          onLoad={() => setLoadedOriginal(true)}
          onError={() => setFailedOriginal(item.image)}
        />
      </span>
      {scene && failedSource !== scene.src && (
        <span
          className={`scene-image-plane scene-personalized-plane ${personalized && originalLarge ? "is-inset" : "is-main"}`}
          aria-hidden={!personalized ? true : undefined}
        >
          <img
            key={scene.src}
            className="scene-personalized"
            src={scene.src}
            alt={sceneAlt}
            loading="lazy"
            onLoad={() => setLoadedSource(scene.src)}
            onError={() => setFailedSource(scene.src)}
          />
        </span>
      )}
      <button
        type="button"
        className="product-image-button scene-open-button"
        onClick={onOpen}
        aria-label={L(`查看${item.name}`, `View ${item.en}`)}
      />
      {giftContext && (
        <>
          <span className="gift-model-note">
            <strong>{L("礼赠灵感", "A GIFT IDEA")}</strong>
            <span>
              {personalized
                ? L(
                    "虚构模特 · 非本人或受赠人",
                    "Fictional model · not you or the recipient",
                  )
                : L(
                    "当前颜色暂无模特图 · 商品概念展示",
                    "No model scene for this colour · product concept",
                  )}
            </span>
          </span>
          <span className="gift-scene-packaging">
            <img
              src={giftContext.packaging.image}
              alt={L(
                `${giftContext.packaging.zh}包装概念图`,
                `${giftContext.packaging.en}, wrapping concept`,
              )}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />
            <span>{L("包装概念", "WRAPPING IDEA")}</span>
          </span>
        </>
      )}
      {!personalized && (
        <span
          className="scene-image-caption scene-fallback-caption"
          data-scene-fallback="original"
        >
          {L("原始商品概念图", "ORIGINAL PRODUCT CONCEPT")}
        </span>
      )}
      {personalized && (
        <>
          <button
            type="button"
            ref={swapRef}
            className="scene-swap-button"
            aria-describedby={tutorialActive ? tutorialId : undefined}
            onClick={(event) => {
              event.stopPropagation();
              if (tutorialActive && !event.nativeEvent.isTrusted) return;
              if (event.nativeEvent.isTrusted)
                finishSceneSwapTutorial(tutorialCase, "swapped");
              setHasSwapped(true);
              setSelection((current) =>
                current === scene.src ? null : scene.src,
              );
            }}
            aria-label={swapLabel}
          >
            <span className="scene-inset-label" aria-hidden="true">
              {originalLarge ? sceneLabel : L("商品图", "PRODUCT")}
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 7h11m-3-3 3 3-3 3M16 13H5m3-3-3 3 3 3" />
              </svg>
            </span>
          </button>
          {tutorialActive && (
            <span className="scene-tutorial-hand" aria-hidden="true">
              <svg viewBox="0 0 40 48" fill="none">
                <path d="M14 25V9a3 3 0 0 1 6 0v13-6a3 3 0 0 1 6 0v8-5a3 3 0 0 1 6 0v7-3a3 3 0 0 1 6 0v9c0 8-5 12-12 12h-3c-4 0-7-2-9-5L5 27a3 3 0 0 1 4-4l5 5" />
                <path
                  className="scene-tutorial-tap"
                  d="M10 5 7 2M23 5l3-3M16 3V0"
                />
              </svg>
            </span>
          )}
          <span
            className={
              tutorialActive
                ? "scene-swap-tutorial"
                : "scene-swap-tutorial-measure"
            }
            role={tutorialActive ? "group" : undefined}
            aria-hidden={!tutorialActive ? true : undefined}
            aria-label={L("大小图互换引导", "Image swap guide")}
          >
            <svg
              className="scene-tutorial-diagram"
              viewBox="0 0 48 38"
              fill="none"
              aria-hidden="true"
            >
              <rect x="1" y="2" width="30" height="34" rx="3" />
              <rect x="21" y="5" width="23" height="23" rx="3" />
              <path d="M7 16h10m-3-3 3 3-3 3M37 30H27m3-3-3 3 3 3" />
            </svg>
            <span id={tutorialId} className="scene-tutorial-copy">
              <strong>
                {L("点右上小图，交换大小图", "Tap the top-right image to swap")}
              </strong>
              <span>
                {L(
                  "请亲自点击一次后继续 · 支持 Enter / 空格",
                  "Swap once to continue · Enter / Space also works",
                )}
              </span>
            </span>
            <button
              type="button"
              className="scene-tutorial-dismiss"
              tabIndex={tutorialActive ? undefined : -1}
              onClick={(event) => {
                event.stopPropagation();
                finishSceneSwapTutorial(tutorialCase, "dismissed");
                swapRef.current?.focus({ preventScroll: true });
              }}
              aria-label={L("退出大小图引导", "Exit image swap guide")}
            >
              ×
            </button>
          </span>
          <span className="scene-image-caption" aria-hidden="true">
            {originalLarge ? L("商品图", "PRODUCT") : sceneLabel}
          </span>
          <span className="scene-sr-status" role="status" aria-live="polite">
            {!hasSwapped
              ? ""
              : originalLarge
                ? L(
                    giftContext
                      ? "商品图已放大，右上角为模特展示"
                      : "商品图已放大，右上角为 AI 场景",
                    giftContext
                      ? "Product image enlarged. Model styling is at the top right."
                      : "Product image enlarged. AI scene is at the top right.",
                  )
                : L(
                    giftContext
                      ? "模特展示已放大，右上角为商品图"
                      : "AI 场景已放大，右上角为商品图",
                    giftContext
                      ? "Model styling enlarged. Product image is at the top right."
                      : "AI scene enlarged. Product image is at the top right.",
                  )}
          </span>
        </>
      )}
    </span>
  );
}
