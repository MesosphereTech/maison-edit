import React, { useEffect, useRef, useState } from "react";
import {
  personaPresets,
  homePresets,
  getPersonaPreset,
  getHomePreset,
} from "./presets.js";
import { curatedScenarios } from "./personalized-scenes.js";
import { byId } from "./data.js";
import {
  initialDemoScenario,
  confirmedDemoProfile,
  DEMO_COMPOSE_DURATION,
  DEMO_ASSET_DEADLINE,
  DEMO_CRITICAL_SCENE_COUNT,
  demoScenePreview,
} from "./demo-personalization.js";
import "./demo-personalization.css";

function Arrow({ back = false }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
      style={back ? { transform: "rotate(180deg)" } : undefined}
    >
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </svg>
  );
}

function preload(src, signal) {
  return new Promise((resolve) => {
    const image = new Image();
    const finish = (loaded) => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", cancel);
      resolve(loaded);
    };
    const cancel = () => {
      finish(false);
      image.src = "";
    };
    signal.addEventListener("abort", cancel, { once: true });
    image.onload = async () => {
      // An unsupported decode method must not prevent an otherwise loaded image.
      if (image.decode) await image.decode().catch(() => {});
      finish(!signal.aborted && image.naturalWidth > 0);
    };
    image.onerror = () => finish(false);
    image.src = src;
  });
}

// Each page load requires a choice. One confirmation loads assets, then enters
// the shop directly; there is no separate result page or second entry action.
export default function StoreOnboarding({
  profile,
  L,
  onComplete,
  soundMuted = false,
  language = "en",
  onLanguageChange,
}) {
  const [scenarioId, setScenarioId] = useState(
    () => initialDemoScenario(profile).id,
  );
  const [phase, setPhase] = useState("choose");
  const [hint, setHint] = useState(false);
  const [muted, setMuted] = useState(soundMuted);
  const dialog = useRef(null);
  const heading = useRef(null);
  const cancelLoad = useRef(null);
  const scenario = curatedScenarios.find((entry) => entry.id === scenarioId);
  const persona = getPersonaPreset(scenario.personaId);
  const home = getHomePreset(scenario.homeId);
  const products = demoScenePreview(scenario)
    .slice(0, DEMO_CRITICAL_SCENE_COUNT)
    .map((entry) => ({
      ...entry,
      item: byId(entry.skuId),
      src: `/personalized-scenes/${entry.file}`,
    }));

  useEffect(() => {
    const node = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      document.querySelector(".shop-intro h1")?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    setMuted(soundMuted);
  }, [soundMuted]);
  useEffect(() => {
    const update = (event) => setMuted(Boolean(event.detail?.muted));
    document.addEventListener("maison:music-muted", update);
    return () => document.removeEventListener("maison:music-muted", update);
  }, []);
  useEffect(() => {
    if (phase !== "loading") return;
    let active = true;
    const controller = new AbortController();
    const timers = [];
    const minimum = new Promise((resolve) =>
      timers.push(setTimeout(resolve, DEMO_COMPOSE_DURATION)),
    );
    const assets = Promise.all(
      products.map((product) => preload(product.src, controller.signal)),
    );
    const bounded = Promise.race([
      assets.then((loaded) => loaded.every(Boolean)),
      new Promise((resolve) =>
        timers.push(setTimeout(() => resolve(false), DEMO_ASSET_DEADLINE)),
      ),
    ]);
    const cancel = () => {
      active = false;
      controller.abort();
      timers.forEach(clearTimeout);
    };
    cancelLoad.current = cancel;
    Promise.all([minimum, bounded]).then(([, loaded]) => {
      if (!active) return;
      if (loaded) onComplete(confirmedDemoProfile(profile, scenarioId));
      else {
        setPhase("unavailable");
      }
    });
    return () => {
      cancel();
      if (cancelLoad.current === cancel) cancelLoad.current = null;
    };
  }, [phase, scenarioId]);

  useEffect(() => {
    if (phase === "unavailable")
      dialog.current
        ?.querySelector(".demo-setup-retry")
        ?.focus({ preventScroll: true });
    else if (phase === "loading")
      dialog.current
        ?.querySelector(".demo-setup-back")
        ?.focus({ preventScroll: true });
  }, [phase]);

  const back = () => {
    cancelLoad.current?.();
    setHint(false);
    setPhase("choose");
    // The selection remains on screen, so keep focus near the interrupted action.
    requestAnimationFrame(() =>
      dialog.current
        ?.querySelector(".demo-setup-compose")
        ?.focus({ preventScroll: true }),
    );
  };
  const start = () => {
    setHint(false);
    setPhase("loading");
  };

  return (
    <dialog
      ref={dialog}
      className={`store-onboarding demo-setup is-${phase}`}
      data-setup-phase={phase}
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
      onCancel={(event) => {
        event.preventDefault();
        if (phase !== "choose") back();
        else setHint(true);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...dialog.current.querySelectorAll(
            "button, summary, a[href], [tabindex='0']",
          ),
        ].filter(
          (element) => !element.disabled && element.getClientRects().length,
        );
        const first = controls[0],
          last = controls.at(-1);
        if (
          event.shiftKey &&
          [first, heading.current, dialog.current].includes(
            document.activeElement,
          )
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header className="demo-setup-header">
        <span className="demo-setup-wordmark">
          MAISON <i>ÉDIT</i>
        </span>
        <span className="demo-setup-private">YOUR PRIVATE EDIT</span>
        {onLanguageChange && (
          <button
            type="button"
            className="demo-setup-language"
            onClick={onLanguageChange}
            aria-label={language === "zh" ? "Switch to English" : "切换至中文"}
          >
            {language === "zh" ? "EN" : "中文"}
          </button>
        )}
        <button
          type="button"
          className="demo-setup-mute"
          data-store-music-ui
          aria-pressed={muted}
          onClick={() =>
            document.dispatchEvent(new CustomEvent("maison:toggle-music-mute"))
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <path d="M4 9h4l5-4v14l-5-4H4V9Z" />
            <path
              d={
                muted
                  ? "m17 9 5 6m0-6-5 6"
                  : "M16 7a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"
              }
            />
          </svg>
          {muted ? L("开启声音", "Unmute") : L("静音", "Mute")}
        </button>
      </header>
      <div className="demo-setup-body">
        <div className="demo-setup-intro">
          <p className="eyebrow">
            {L("选择模板 → 进入商店", "CHOOSE A SET → ENTER THE STORE")}
          </p>
          <h1 id="onboarding-title" tabIndex={-1} ref={heading}>
            {L("选一组模板，开始逛店。", "Choose a set. Step into the store.")}
          </h1>
          <p id="onboarding-description">
            {L(
              "用虚构人物和客厅体验商品搭配。选好后直接进店，商品会展示这组模板的预生成穿搭或家居场景，无需上传照片。",
              "Try the store with a fictional person and living room. Your choice sets the pre-generated wardrobe and home scenes you’ll see on products. No photo uploads.",
            )}
          </p>
        </div>
        <div className="demo-setup-selection">
          <div
            className="demo-setup-references"
            aria-label={L("已选虚构模板预览", "Selected fictional references")}
          >
            <figure className="demo-setup-room">
              <img
                src={home.images.living}
                alt={L(
                  `预置虚构客厅：${home.zh}`,
                  `Preset fictional living room: ${home.en}`,
                )}
                fetchPriority="high"
              />
              <figcaption>
                {L(home.zh, home.en)} · {L("虚构客厅", "Fictional living room")}
              </figcaption>
            </figure>
            <figure className="demo-setup-person">
              <img
                src={persona.image}
                alt={L(
                  `预置虚构人物：${persona.zh}`,
                  `Preset fictional person: ${persona.en}`,
                )}
              />
              <figcaption>{L(persona.zh, persona.en)}</figcaption>
            </figure>
            <span className="demo-setup-reference-mark">
              {L("已选模板", "Your selected set")}
              <small>{L("虚构人物与空间", "FICTIONAL PERSON & HOME")}</small>
            </span>
          </div>
          <div className="demo-setup-choices">
            <p className="demo-setup-section-label">
              {L("选择一组人物与家的模板", "CHOOSE A PERSON & HOME SET")}
            </p>
            <div
              className="demo-setup-scenarios"
              role="group"
              aria-label={L("可用测试组合", "Available test combinations")}
            >
              {curatedScenarios.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  data-scene-scenario={entry.id}
                  aria-pressed={scenarioId === entry.id}
                  disabled={phase !== "choose"}
                  className="demo-setup-scenario"
                  onClick={() => {
                    setScenarioId(entry.id);
                    setHint(false);
                  }}
                >
                  <span className="demo-setup-choice-dot" aria-hidden="true" />
                  <span>
                    <strong>{L(entry.zh, entry.en)}</strong>
                    <small>{L(entry.noteZh, entry.noteEn)}</small>
                    <em>
                      {L(
                        `${entry.products.length} 件商品配有预生成场景`,
                        `${entry.products.length} pieces with pre-generated scenes`,
                      )}
                    </em>
                  </span>
                </button>
              ))}
            </div>
            <div className="demo-setup-product-strip">
              {products.map((product) => (
                <figure key={product.skuId}>
                  <img src={product.item.image} alt="" />
                  <figcaption>
                    {L(product.item.name, product.item.en)}
                    <small>
                      {product.type === "wear"
                        ? L(
                            "进店查看人物穿搭场景",
                            "See it on the fictional person in store",
                          )
                        : L(
                            "进店查看客厅搭配场景",
                            "See it in the fictional room in store",
                          )}
                    </small>
                  </figcaption>
                </figure>
              ))}
            </div>
            <details className="demo-setup-more">
              <summary>
                {L("更多人物与空间", "More people & spaces")}
                <span>{L("后续开放", "Coming later")}</span>
              </summary>
              <p>
                {L(
                  "以下模板尚未开放商品场景体验，暂不可选择。",
                  "Product scenes for these references are not yet available for selection.",
                )}
              </p>
              <div className="demo-setup-unavailable-grid">
                {personaPresets
                  .filter(
                    (entry) =>
                      !curatedScenarios.some(
                        (option) => option.personaId === entry.id,
                      ),
                  )
                  .map((entry) => (
                    <div
                      key={entry.id}
                      aria-disabled="true"
                      className="demo-setup-unavailable"
                    >
                      <img src={entry.image} alt="" loading="lazy" />
                      <span>
                        {L(entry.zh, entry.en)}
                        <small>{L("模板待开放", "Set coming later")}</small>
                      </span>
                    </div>
                  ))}
                {homePresets
                  .filter(
                    (entry) =>
                      !curatedScenarios.some(
                        (option) => option.homeId === entry.id,
                      ),
                  )
                  .map((entry) => (
                    <div
                      key={entry.id}
                      aria-disabled="true"
                      className="demo-setup-unavailable"
                    >
                      <img src={entry.images.living} alt="" loading="lazy" />
                      <span>
                        {L(entry.zh, entry.en)}
                        <small>{L("模板待开放", "Set coming later")}</small>
                      </span>
                    </div>
                  ))}
              </div>
              <p>
                {L(
                  "厨房、卧室等其他房间的商品场景也将后续开放。",
                  "Product scenes for kitchens, bedrooms and other rooms are also coming later.",
                )}
              </p>
            </details>
            {hint && (
              <p className="demo-setup-hint" role="status">
                {L(
                  "请先确认一组模板，再进入商店。",
                  "Confirm a set to enter the store.",
                )}
              </p>
            )}
          </div>
        </div>
        <p className="demo-setup-disclosure">
          {L(
            "虚构模板 · 预生成图片，非实时生成。穿搭效果和空间比例仅供参考。",
            "Fictional references · Pre-generated images, no live generation. Fit and room scale are illustrative.",
          )}
        </p>
      </div>
      <footer className="demo-setup-footer">
        <div
          className="demo-setup-footer-status"
          aria-live="polite"
          aria-atomic="true"
        >
          {phase === "loading" ? (
            <div className="demo-setup-loading">
              <span className="demo-compose-indicator" aria-hidden="true" />
              <span>
                <strong>
                  {L("正在加载模板图片…", "Loading your selected images…")}
                </strong>
                <small>
                  {L(
                    "预生成素材加载完成后，自动进入商店。",
                    "Pre-generated assets. You’ll enter the store automatically.",
                  )}
                </small>
              </span>
            </div>
          ) : phase === "unavailable" ? (
            <div className="demo-setup-error">
              <strong>
                {L("图片暂时没加载好。", "The images couldn’t load.")}
              </strong>
              <small>
                {L(
                  "重试，或返回更换模板。也可以先看商品概念图。",
                  "Retry or change your set. You can also browse the product concepts.",
                )}
              </small>
            </div>
          ) : (
            <span className="demo-setup-footer-note">
              {L(`已选：${scenario.zh}`, `Selected: ${scenario.en}`)}
            </span>
          )}
        </div>
        <div className="demo-setup-actions">
          {phase !== "choose" && (
            <button type="button" className="demo-setup-back" onClick={back}>
              <Arrow back />
              {L("返回修改", "Change set")}
            </button>
          )}
          {phase === "choose" && (
            <button
              type="button"
              className="demo-setup-compose"
              onClick={start}
            >
              {L("用这组模板，进入商店", "Use this set & enter store")}
              <Arrow />
            </button>
          )}
          {phase === "loading" && (
            <button
              type="button"
              className="demo-setup-pending"
              aria-busy="true"
              disabled
            >
              <span className="demo-setup-spinner" aria-hidden="true" />
              {L("准备进店…", "Opening store…")}
            </button>
          )}
          {phase === "unavailable" && (
            <>
              <button
                type="button"
                className="demo-setup-retry"
                onClick={start}
              >
                {L("重新加载", "Retry images")}
              </button>
              <button
                type="button"
                className="demo-setup-enter"
                onClick={() =>
                  onComplete(confirmedDemoProfile(profile, scenarioId))
                }
              >
                {L("先逛商品", "Browse concepts")}
                <Arrow />
              </button>
            </>
          )}
        </div>
      </footer>
    </dialog>
  );
}
