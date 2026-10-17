import { createPortal } from "react-dom";
import { SubtitleConcierge, useBubbleStream } from "./SubtitleConcierge.jsx";
import { guideFailure } from "./guide-service.js";
import { conciergeTargets } from "./concierge-visibility.js";
import { createTryListGuideReply } from "./try-list-guide.js";
import { useCatalogAttention } from "./useCatalogAttention.jsx";
import { targetRect } from "./attention.js";
import EndlessEditorialFeed from "./EndlessEditorialFeed.jsx";
import PurchaseHistory from "./PurchaseHistory.jsx";
import StoreOnboarding from "./StoreOnboarding.jsx";
import StoreMusic from "./StoreMusic.jsx";
import { musicArrivalPreferences } from "./store-music.js";
import PersonalizedScene from "./PersonalizedScene.jsx";
import SceneScenarios from "./SceneScenarios.jsx";
import OutfitLinks from "./OutfitLinks.jsx";
import { GiftPackagingEditor, GiftSummary } from "./GiftPackaging.jsx";
import { normalizeGift, sameGiftPreferences } from "./gift-packaging.js";
import {
  tryListVariant,
  tryListSizeLabel,
  tryListPreparationLabel,
  isTryOnPiece,
  tryListRecipientSizes,
} from "./try-list.js";
import TryListPreparation from "./TryListPreparation.jsx";
import "./try-list.css";
import GuidedDemo, {
  restartGuidedCase,
  resetAllGuidedCases,
} from "./GuidedDemo.jsx";
import VisitJourneyShowcase, {
  clearVisitPlanningSessions,
} from "./VisitJourneyShowcase.jsx";
import "./revision-personalization.css";
import { curatedScenarioFor, curatedScenarios } from "./personalized-scenes.js";
import {
  createGuideDialogueReply,
  dialogueBank,
  guideSessionSummary,
} from "./guide-dialogue-bank.js";
import { sanitizePurchaseHistory } from "./purchase-history.js";
import {
  createConciergeSession,
  acceptConciergeEvent,
  createConciergeReply,
} from "./concierge.js";
import {
  personaPresets,
  homePresets,
  getPersonaPreset,
  getHomePreset,
  roomNames,
  roomReference,
  presetContext,
} from "./presets.js";
import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  catalog,
  IMAGE,
  STORAGE_KEY,
  initialState,
  demoHistoryForProfile,
  byId,
  money,
  sumItems,
  buildFeed,
  cheaperAlternative,
  lookDefinitions,
  makeBooking,
  styles,
  categories,
  skuQuantity,
  cartUnavailable,
  restoreState,
  switchCuratedCase,
} from "./data.js";

const paths = {
  arrow: "M4 12h16m-6-6 6 6-6 6",
  close: "m6 6 12 12M18 6 6 18",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  bag: "M5 7h14l2 14H3L5 7Zm3 0V5a4 4 0 0 1 8 0v2",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  person: "M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM3 22v-3a9 9 0 0 1 18 0v3",
  sound: "M4 9h4l5-4v14l-5-4H4V9Zm12-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16",
  muted: "M4 9h4l5-4v14l-5-4H4V9Zm12 0 6 6m0-6-6 6",
  check: "m4 12 5 5L20 6",
  calendar: "M5 3v4m14-4v4M3 10h18M3 5h18v16H3V5Z",
  spark: "m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z",
  route:
    "M5 5a2 2 0 1 0 0 .1M19 19a2 2 0 1 0 0 .1M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h8",
  menu: "M4 6h16M4 12h16M4 18h16",
  minus: "M5 12h14",
  plus: "M5 12h14M12 5v14",
  home: "m2 11 10-9 10 9M5 9v13h14V9M9 22v-8h6v8",
  clock: "M12 7v5l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 16h12l1-16M10 10v8m4-8v8",
  upload: "M12 16V2m-5 5 5-5 5 5M3 15v7h18v-7",
  chevron: "m8 4 8 8-8 8",
  store:
    "M3 3h18l1 6a4 4 0 0 1-6 3 4 4 0 0 1-8 0 4 4 0 0 1-6-3l1-6Zm1 11v8h16v-8M8 22v-7h8v7",
};
function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.spark} />
    </svg>
  );
}
function Picture({
  src,
  alt,
  className = "",
  position,
  kind = "blazer",
  ...props
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <img
      className={className}
      src={failed ? `/images/${kind}.svg` : src}
      alt={alt}
      style={{ objectPosition: position }}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}
function useStore() {
  const [boot] = useState(() => {
    try {
      const restored = restoreState(
        JSON.parse(localStorage.getItem(STORAGE_KEY)),
      );
      return {
        ...restored,
        state: {
          ...restored.state,
          ...musicArrivalPreferences(restored.state),
        },
      };
    } catch {
      return { state: initialState(), recovered: true };
    }
  });
  const [error, setError] = useState("");
  const [state, setState] = useState(boot.state);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setError("");
    } catch {
      setError(
        state.language === "zh"
          ? "当前浏览器无法保存全部数据。请检查存储权限，或从偏好与数据中清理不需要的旧数据。"
          : "This browser cannot save all demo data. Check storage permissions or remove old demo data in Preferences & data.",
      );
    }
  }, [state]);
  return [
    state,
    setState,
    error ||
      (boot.recovered
        ? state.language === "zh"
          ? "保存的演示数据无法完整读取，已恢复默认状态。"
          : "Saved demo data could not be fully read. Defaults have been restored."
        : ""),
  ];
}
function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
  drawer = false,
  conciergeProductId,
  className = "",
}) {
  const ref = useRef();
  useEffect(() => {
    const old = document.activeElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const focusSelector = 'button,input,select,textarea,a,[tabindex="0"]';
        const all = [
          ...ref.current.querySelectorAll(focusSelector),
          ...(conciergeProductId
            ? document.querySelectorAll(
                ".subtitle-concierge button,.subtitle-composer input,.subtitle-composer button",
              )
            : []),
        ];
        const arr = all.filter(
          (el) => !el.disabled && el.getClientRects().length,
        );
        const first = arr[0],
          last = arr.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      old?.focus();
    };
  }, [onClose]);
  return (
    <div
      className={`overlay ${drawer ? "drawer-overlay" : ""} ${className}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""} ${drawer ? "drawer" : ""}`}
        role="dialog"
        id={
          conciergeProductId
            ? `concierge-current-${conciergeProductId}`
            : undefined
        }
        data-concierge-current-product={conciergeProductId}
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <header className="modal-head">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close / 关闭"
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function TagButton({ active, children, onClick, ...props }) {
  return (
    <button
      className={`tag ${active ? "active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  );
}

function useAIServiceStatus() {
  const [status, setStatus] = useState({
    provider: import.meta.env.VITE_AI_PROVIDER || "gemini",
    guide: "unavailable",
    analysis: "unavailable",
    scene: "unavailable",
  });
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch(import.meta.env.VITE_AI_STATUS_ENDPOINT || "/api/status", {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((value) => {
        if (
          !controller.signal.aborted &&
          ["codex-cli", "gemini", "demo"].includes(value.provider)
        )
          setStatus(value);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch(
        import.meta.env.VITE_AI_STATUS_ENDPOINT || "/api/status",
      );
      const value = await r.json();
      if (r.ok && ["codex-cli", "gemini", "demo"].includes(value.provider))
        setStatus(value);
    } catch {}
  }, []);
  return { ...status, refresh };
}
export default function App() {
  const [state, setState, storageError] = useStore();
  const serviceStatus = useAIServiceStatus();
  const lang = state.language;
  const L = useCallback((zh, en) => (lang === "zh" ? zh : en), [lang]);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);
  const [view, setView] = useState("discover");
  const [setupConfirmed, setSetupConfirmed] = useState(false);
  const [modal, setModal] = useState("onboarding");
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({
    query: "",
    category: "all",
    budget: 10000,
  });
  const [toast, setToast] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideEvent, setGuideEvent] = useState(null);
  const [subtitleHost, setSubtitleHost] = useState(null);
  const [visitCompanionHost, setVisitCompanionHost] = useState(null);
  const guideSequence = useRef(0);
  const guideContextKey = JSON.stringify([
    view,
    filters,
    state.profile.personaId,
    state.profile.homeId,
    state.profile.room,
    state.profile.styles,
    state.purchaseHistory,
    modal,
    selected?.id,
  ]);
  const signalGuide = useCallback(
    (event) => {
      setGuideEvent({
        ...event,
        contextKey: guideContextKey,
        sequence: ++guideSequence.current,
      });
    },
    [guideContextKey],
  );
  useEffect(() => {
    if (view === "saved" || view === "visit")
      signalGuide({ type: "page", page: view === "saved" ? "try-list" : view });
  }, [view, signalGuide]);
  const openProduct = (item) => {
    if (!item) return;
    // One inspection signal covers image/name, outfit, guide and tour entry paths.
    window.dispatchEvent(
      new CustomEvent("maison:product-inspect", {
        detail: { productId: item.id },
      }),
    );
    setSelected(item);
    setModal("product");
  };
  useEffect(() => {
    if (modal === "product" && selected)
      signalGuide({ type: "product_open", productId: selected.id });
  }, [modal, selected?.id, signalGuide]);
  const [mobileNav, setMobileNav] = useState(false);
  const toastIt = useCallback((text) => setToast({ text, id: Date.now() }), []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(null), 4200);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const update = useCallback(
    (fn) =>
      setState((s) => (typeof fn === "function" ? fn(s) : { ...s, ...fn })),
    [setState],
  );
  const feed = useMemo(
    () => buildFeed(filters, state.profile, state.feedback),
    [filters, state.profile, state.feedback],
  );
  const toggleSave = (id, occurrenceId) => {
    const item = byId(id);
    if (!item) return;
    const existing = state.cart.find(
      (line) => line.skuId === id && !line.gift?.isGift,
    );
    if (existing?.fit && existing.fit.source !== "legacy") {
      signalGuide({
        type: "add",
        productId: id,
        occurrenceId,
        variant: { size: existing.size, color: existing.color },
        fit: existing.fit,
        preparation: existing.preparation || { status: "pending" },
        value: "already-listed",
      });
      toastIt(
        L(
          "已在到店清单中，不会重复加入",
          "Already in your store list. No duplicate added.",
        ),
      );
      return;
    }
    addCart(id, tryListVariant(item, state.profile).size, item.color, 1);
  };
  const addCart = (
    skuId,
    size = state.profile.size,
    color = byId(skuId)?.color,
    quantity = 1,
    giftPreference = null,
  ) => {
    quantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const item = byId(skuId);
    if (!item) return;
    const gift = normalizeGift(giftPreference);
    const matchedVariant = tryListVariant(item, state.profile, gift);
    size = matchedVariant.size;
    const existing = state.cart.find(
      (x) =>
        x.skuId === skuId &&
        x.size === size &&
        x.color === color &&
        sameGiftPreferences(x.gift, gift),
    );
    const additionalQuantity = Math.max(
      0,
      quantity - (existing?.quantity || 0),
    );
    const preparation =
      additionalQuantity > 0 || !existing?.preparation
        ? { status: "pending", submittedAt: new Date().toISOString() }
        : existing.preparation;
    if (
      (state.inventory[skuId] ?? 0) <
      skuQuantity(state.cart, skuId) + additionalQuantity
    ) {
      toastIt(
        L(
          "演示库存不足，请查看替代款",
          "Demo inventory is unavailable. Try an alternative.",
        ),
      );
      return;
    }
    update((s) => {
      const exists = s.cart.find(
        (x) =>
          x.skuId === skuId &&
          x.size === size &&
          x.color === color &&
          sameGiftPreferences(x.gift, gift),
      );
      return {
        ...s,
        cart: exists
          ? s.cart.map((x) =>
              x === exists
                ? {
                    ...x,
                    preparation,
                    fit: matchedVariant.fit,
                    quantity: Math.min(
                      Math.max(x.quantity, quantity),
                      s.inventory[skuId],
                    ),
                  }
                : x,
            )
          : [
              ...s.cart,
              {
                lineId: `${skuId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                skuId,
                size,
                color,
                quantity,
                fit: matchedVariant.fit,
                preparation,
                ...(gift ? { gift } : {}),
              },
            ],
      };
    });
    signalGuide({
      type: "add",
      productId: skuId,
      fit: matchedVariant.fit,
      preparation,
      giftPending: Boolean(gift && matchedVariant.fit.status === "pending"),
      ...(gift ? { gift } : {}),
      variant: { size, color, fit: matchedVariant.fit },
      value: `${size}/${color}`,
    });
    toastIt(
      L(
        "已加入到店清单并提交本地备货请求",
        "Store list updated; demo preparation requested",
      ),
    );
  };
  const addEdit = (ids) => {
    ids.forEach((id) =>
      addCart(
        id,
        byId(id).sizes.includes(state.profile.size)
          ? state.profile.size
          : byId(id).sizes[0],
      ),
    );
    toastIt(L("整组已加入到店尝试清单", "The edit is in your store list"));
  };
  const feedback = (id, value) => {
    update((s) => ({ ...s, feedback: { ...s.feedback, [id]: value } }));
    toastIt(
      value === "like"
        ? L("会为你编选更多相似风格", "We’ll bring you more of this style")
        : L(
            "已减少此款推荐，可在偏好中重置",
            "Hidden from your recommendations. Reset in preferences.",
          ),
    );
  };
  const navigate = (next) => {
    setView(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const changeCategory = (cat) => {
    setFilters((f) => ({ ...f, category: cat }));
    navigate("discover");
    setTimeout(
      () =>
        document.getElementById("the-edit")?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        }),
      10,
    );
  };
  const closeModal = useCallback(() => {
    setModal(null);
    setSelected(null);
  }, []);
  return (
    <div
      className="storefront-shell"
      hidden={!setupConfirmed}
      inert={!setupConfirmed}
    >
      <a className="skip-link" href="#main">
        {L("跳至主要内容", "Skip to content")}
      </a>
      <div className="announcement">
        <span>
          {L(
            "为你的衣橱与家，编选一种生活",
            "A considered world. For your wardrobe and your home.",
          )}
        </span>
        <span className="demo-badge">
          {L("交互演示 · 原创视觉", "INTERACTIVE DEMO · ORIGINAL VISUALS")}
        </span>
      </div>
      <header className="site-header">
        <button
          className="mobile-menu icon-button"
          aria-label={L("打开导航", "Open navigation")}
          aria-expanded={mobileNav}
          aria-controls="primary-navigation"
          onClick={() => setMobileNav(!mobileNav)}
        >
          <Icon name="menu" />
        </button>
        <button
          className="wordmark"
          onClick={() => navigate("discover")}
          aria-label="MAISON ÉDIT home"
        >
          MAISON <span>ÉDIT</span>
          <small>THE PRIVATE DEPARTMENT STORE</small>
        </button>
        <nav
          id="primary-navigation"
          className={mobileNav ? "open" : ""}
          aria-label={L("主要导航", "Main navigation")}
        >
          <button
            className={view === "discover" ? "current" : ""}
            onClick={() => navigate("discover")}
          >
            {L("发现", "Discover")}
          </button>
          <button
            onClick={() =>
              changeCategory(getPersonaPreset(state.profile.personaId).category)
            }
          >
            {L(
              getPersonaPreset(state.profile.personaId).category === "men"
                ? "男士衣橱"
                : "女士衣橱",
              getPersonaPreset(state.profile.personaId).category === "men"
                ? "Menswear"
                : "Womenswear",
            )}
          </button>
          <button onClick={() => changeCategory("home")}>
            {L("家与生活", "Home & living")}
          </button>
          <button
            className={view === "visit" ? "current" : ""}
            onClick={() => navigate("visit")}
          >
            {L("到店之旅", "Your visit")}
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="language"
            onClick={() =>
              update((s) => ({ ...s, language: lang === "zh" ? "en" : "zh" }))
            }
            aria-label={L("Switch to English", "切换至中文")}
          >
            {lang === "zh" ? "EN" : "中文"}
          </button>
          <button
            className="icon-button profile-nav"
            onClick={() => setModal("profile")}
            aria-label={L("我的偏好", "Edit your profile")}
          >
            <Icon name="person" />
          </button>
          <button
            className="try-list-nav"
            onClick={() => navigate("saved")}
            aria-label={L("到店尝试清单", "Store try-on & experience list")}
          >
            <Icon name="bag" />
            <span>{L("到店清单", "Store list")}</span>
            {state.cart.length > 0 && (
              <span className="count">{state.cart.length}</span>
            )}
          </button>
        </div>
      </header>
      {storageError && (
        <div className="storage-warning" role="alert">
          {storageError}
        </div>
      )}
      <main id="main">
        {view === "discover" ? (
          <>
            <section className="shop-intro" data-concierge-section="hero">
              <div className="shop-intro-copy">
                <p className="eyebrow">THE PRIVATE EDIT / Nº 01</p>
                <h1 tabIndex={-1}>
                  {L(
                    "为你编选，恰好的每一件。",
                    "A world, with your point of view.",
                  )}
                </h1>
                <p>
                  {L(
                    "从衣橱到家，发现让日常更动人的选择。",
                    "Considered pieces for your wardrobe, your home and the everyday.",
                  )}
                </p>
                <div className="shop-context">
                  <button
                    className="shop-preference-entry"
                    aria-label={L("我的偏好", "My preferences")}
                    onClick={() => setModal("profile")}
                  >
                    <Icon name="person" size={15} />
                    <span>{L("我的偏好", "My preferences")}</span>
                    <span className="shop-context-detail">
                      {L(
                        getPersonaPreset(state.profile.personaId).zh,
                        getPersonaPreset(state.profile.personaId).en,
                      )}{" "}
                      ·{" "}
                      {L(
                        getHomePreset(state.profile.homeId).zh,
                        getHomePreset(state.profile.homeId).en,
                      )}
                    </span>
                    <Icon name="chevron" size={12} />
                  </button>
                  <button
                    className="shop-history-entry"
                    onClick={() => setModal("history")}
                    aria-label={L(
                      "编选虚构购买记录",
                      "Edit fictional purchase history",
                    )}
                  >
                    <Icon name="clock" size={14} />
                    <span>
                      {L("虚构购买记录", "Fictional history")} ·{" "}
                      {state.purchaseHistory.length}
                    </span>
                  </button>
                </div>
              </div>
              <figure className="shop-intro-visual">
                <Picture
                  src="/images/editorial-home.webp"
                  alt={L(
                    "原创虚构家居灵感",
                    "Original fictional home inspiration",
                  )}
                />
                <figcaption>THE ART OF EVERYDAY LIVING</figcaption>
              </figure>
            </section>
            <section id="the-edit" className="edit-section">
              <p className="scene-availability shop-scene-status">
                {curatedScenarioFor(state.profile)
                  ? L(
                      "搭配效果与商品图，一起看看。点击右上角小图，可互换大小图。",
                      "See the styled scene alongside its product. Click the top-right thumbnail to swap the two views.",
                    )
                  : L(
                      "当前组合暂无预先生成的商品场景，显示原始商品概念图。可在偏好中选择场景组合。",
                      "This combination has no prepared product scenes. Original product concepts are shown. Choose a prepared combination in preferences.",
                    )}
              </p>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">SELECTED FOR YOUR WORLD</p>
                  <h2>{L("你的生活，逐页展开。", "Your world, unfolding.")}</h2>
                </div>
                <span className="issue">THE EDIT / Nº 01</span>
              </div>
              <div className="filter-bar">
                <div
                  className="category-tabs"
                  role="group"
                  aria-label={L("商品分类", "Product categories")}
                >
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      className={filters.category === c.id ? "active" : ""}
                      onClick={() =>
                        setFilters((f) => ({ ...f, category: c.id }))
                      }
                    >
                      {lang === "zh" ? c.zh : c.en}
                    </button>
                  ))}
                </div>
                <div className="filter-tools">
                  <label className="search-field">
                    <Icon name="search" size={17} />
                    <input
                      aria-label={L(
                        "搜索商品或风格",
                        "Search products or styles",
                      )}
                      value={filters.query}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, query: e.target.value }))
                      }
                      placeholder={L("搜索灵感 / 商品", "Search the edit")}
                    />
                    {filters.query && (
                      <button
                        className="icon-button"
                        aria-label={L("清除搜索", "Clear search")}
                        onClick={() => setFilters((f) => ({ ...f, query: "" }))}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </label>
                  <label className="budget-filter">
                    <span>{L("单品预算", "Per-item budget")}</span>
                    <select
                      aria-label={L("单品最高预算", "Maximum per-item budget")}
                      value={filters.budget}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          budget: Number(e.target.value),
                        }))
                      }
                    >
                      {[
                        ...new Set([
                          1000,
                          2000,
                          3000,
                          5000,
                          10000,
                          filters.budget,
                        ]),
                      ]
                        .sort((a, b) => a - b)
                        .map((n) => (
                          <option key={n} value={n}>
                            {n === 10000
                              ? L("不限", "All prices")
                              : money(n, lang)}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="filter-context">
                <span>
                  {L(
                    `${feed.filter((entry) => entry.type === "product").length} 件单品为你编选`,
                    `${feed.filter((entry) => entry.type === "product").length} pieces selected for you`,
                  )}
                </span>
                <button onClick={() => setGuideOpen(true)}>
                  {L("让导购帮我缩小选择", "Refine with your guide")}
                  <Icon name="arrow" size={14} />
                </button>
              </div>
              {feed.length ? (
                <EndlessEditorialFeed
                  key={JSON.stringify([
                    filters,
                    state.profile.personaId,
                    state.profile.homeId,
                    state.profile.room,
                    state.profile.styles,
                    state.feedback,
                  ])}
                  feed={feed}
                  L={L}
                  renderEntry={(entry) =>
                    entry.type === "product" ? (
                      <ProductCard
                        key={entry.occurrenceId}
                        item={entry.product}
                        state={state}
                        L={L}
                        index={entry.position}
                        occurrenceId={entry.occurrenceId}
                        feedPosition={entry.position}
                        onOpen={() => openProduct(entry.product)}
                        onMatch={(id) => openProduct(byId(id))}
                        onSave={() => toggleSave(entry.id, entry.occurrenceId)}
                        onFeedback={(v) => feedback(entry.id, v)}
                      />
                    ) : (
                      <EditCard
                        key={entry.occurrenceId}
                        entry={entry}
                        occurrenceId={entry.occurrenceId}
                        feedPosition={entry.position}
                        state={state}
                        L={L}
                        onSave={() => addEdit(entry.ids)}
                        onAdd={() => addEdit(entry.ids)}
                        onOpen={(id) => openProduct(byId(id))}
                      />
                    )
                  }
                  renderPause={(entry, continueBrowsing) => (
                    <div
                      className="feed-pause"
                      data-feed-cycle={entry.cycle}
                      data-feed-position={entry.position}
                    >
                      <VisitEditorial L={L} onVisit={() => navigate("visit")} />
                      <StoreFooter
                        L={L}
                        view={view}
                        setModal={setModal}
                        navigate={navigate}
                      />
                      <div className="feed-pause-next">
                        <p>
                          {L(
                            "稍作停留。下面继续逛，喜欢的单品会再次相遇。",
                            "A moment to pause. More from this same catalog continues below.",
                          )}
                        </p>
                        <button
                          className="line-link"
                          onClick={continueBrowsing}
                        >
                          {L("接着逛", "Continue the edit")}{" "}
                          <Icon name="arrow" size={17} />
                        </button>
                      </div>
                    </div>
                  )}
                />
              ) : (
                <div className="empty-state">
                  <Icon name="search" size={35} />
                  <h3>
                    {L(
                      "这一页，还没有合适的发现。",
                      "No discoveries on this page, yet.",
                    )}
                  </h3>
                  <p>
                    {L(
                      "试试更宽的预算或另一种关键词。",
                      "Try a wider budget or a different search.",
                    )}
                  </p>
                  <button
                    className="button"
                    onClick={() =>
                      setFilters({
                        query: "",
                        category: "all",
                        budget: 10000,
                      })
                    }
                  >
                    {L("重置筛选", "Reset filters")}
                  </button>
                </div>
              )}
            </section>
          </>
        ) : view === "saved" ? (
          <section className="page-section try-list-page">
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR STORE TRY-ON & EXPERIENCE LIST</p>
                <h1>
                  {L(
                    "到店尝试，先为你准备。",
                    "Your store list, ready to prepare.",
                  )}
                </h1>
                <p>
                  {L(
                    "清单点击即提交本地演示门店。尺寸按所选虚构人物模板匹配；门店确认前仅为待备货，不是真实预留。",
                    "Each add submits a local demo preparation request. Sizes follow the selected fictional template; preparation awaits store confirmation and creates no real reservation.",
                  )}
                </p>
              </div>
              <button className="button" onClick={() => setModal("bag")}>
                {L("查看清单与备货", "Review list & preparation")} ·{" "}
                {state.cart.length}
              </button>
            </div>
            <TryListPreparation state={state} L={L} merchant={false} />
            {state.cart.length ? (
              <div className="saved-grid">
                {[...new Set(state.cart.map((line) => line.skuId))].map(
                  (id) => (
                    <ProductCard
                      key={id}
                      item={byId(id)}
                      state={state}
                      L={L}
                      onOpen={() => openProduct(byId(id))}
                      onMatch={(id) => openProduct(byId(id))}
                      onSave={() => toggleSave(id)}
                      onFeedback={(v) => feedback(id, v)}
                    />
                  ),
                )}
              </div>
            ) : (
              <Empty
                L={L}
                title={L(
                  "点击加入到店清单，开始一次尝试。",
                  "Add a piece to begin your store list.",
                )}
                onClick={() => navigate("discover")}
              />
            )}
            {state.wishlist.some(
              (id) => !state.cart.some((line) => line.skuId === id),
            ) && (
              <section
                className="legacy-saved-pieces"
                aria-label={L("旧版收藏", "Previous saved pieces")}
              >
                <h2>
                  {L(
                    "旧版收藏，仍为你保留。",
                    "Your previous saved pieces are kept.",
                  )}
                </h2>
                <p>
                  {L(
                    "这些收藏尚未提交备货。请明确点击加入到店清单。",
                    "These saved pieces have not been submitted for preparation. Add them explicitly when ready.",
                  )}
                </p>
                {state.wishlist
                  .filter((id) => !state.cart.some((line) => line.skuId === id))
                  .map((id) => (
                    <button
                      key={id}
                      className="button secondary"
                      onClick={() => toggleSave(id)}
                    >
                      {L(byId(id).name, byId(id).en)} ·{" "}
                      {L("加入到店清单", "Add to store list")}
                    </button>
                  ))}
              </section>
            )}
          </section>
        ) : view === "visit" ? (
          <VisitPage
            companionHostRef={setVisitCompanionHost}
            serviceStatus={serviceStatus}
            onProduct={(id) => openProduct(byId(id))}
            state={state}
            L={L}
            onBook={() => setModal("booking")}
            onBag={() => setModal("bag")}
            onExplore={() => navigate("discover")}
            update={update}
            toastIt={toastIt}
          />
        ) : (
          <MerchantConsole
            state={state}
            update={update}
            L={L}
            toastIt={toastIt}
            onPreparation={signalGuide}
          />
        )}
      </main>
      {(view !== "discover" || !feed.length) && (
        <StoreFooter
          L={L}
          view={view}
          setModal={setModal}
          navigate={navigate}
        />
      )}
      <button
        className="case-switch-button"
        type="button"
        data-change-case
        onClick={() => {
          const current = curatedScenarioFor(state.profile);
          const next =
            curatedScenarios[
              (Math.max(
                0,
                curatedScenarios.findIndex((entry) => entry.id === current?.id),
              ) +
                1) %
                curatedScenarios.length
            ];
          restartGuidedCase(next.id);
          update((s) => switchCuratedCase(s, next.id));
          setFilters({ query: "", category: "all", budget: 10000 });
          setGuideOpen(false);
          closeModal();
          navigate("discover");
          toastIt(L(`已更换案例：${next.zh}`, `Case changed: ${next.en}`));
        }}
        aria-label={L("更换案例", "Change case")}
      >
        <span>{L("更换案例", "Change case")}</span>
        <small>
          {L(
            curatedScenarioFor(state.profile)?.zh || "预设案例",
            curatedScenarioFor(state.profile)?.en || "Prepared case",
          )}{" "}
          ·{" "}
          {Math.max(
            0,
            curatedScenarios.findIndex(
              (entry) => entry.id === curatedScenarioFor(state.profile)?.id,
            ),
          ) + 1}
          /{curatedScenarios.length}
        </small>
      </button>
      <GuidedDemo
        key={`guided-demo:${curatedScenarioFor(state.profile)?.id || `${state.profile.personaId}:${state.profile.homeId}:${state.profile.room}`}`}
        active={setupConfirmed && view === "discover"}
        suspended={guideOpen}
        browsing={view === "discover"}
        state={state}
        modal={modal}
        L={L}
        onProduct={(id) => openProduct(byId(id))}
        onCloseProduct={closeModal}
      />
      <div className="floating-tools">
        <StoreMusic
          state={state}
          update={update}
          L={L}
          Modal={Modal}
          Icon={Icon}
          onOpenChange={(open) => setModal(open ? "music" : null)}
        />
        <button className="concierge-button" onClick={() => setGuideOpen(true)}>
          <Icon name="spark" size={20} />
          <span>{L("你的私人导购", "Your private guide")}</span>
          <span className="guide-dot" />
        </button>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {toast.text}
        </div>
      )}
      {["profile", "history"].includes(modal) && (
        <ProfileModal
          initialTab={modal === "history" ? "history" : "persona"}
          onReplay={() => {
            setSetupConfirmed(false);
            setModal("onboarding");
          }}
          state={state}
          update={update}
          L={L}
          onClose={closeModal}
          toastIt={toastIt}
          serviceStatus={serviceStatus}
        />
      )}
      {modal === "product" && selected && (
        <ProductModal
          item={selected}
          state={state}
          L={L}
          onClose={closeModal}
          onAdd={addCart}
          onSave={() => toggleSave(selected.id)}
          onAlternative={(id) => openProduct(byId(id))}
          onVariant={signalGuide}
          subtitleHostRef={setSubtitleHost}
        />
      )}
      {modal === "bag" && (
        <BagModal
          state={state}
          update={update}
          L={L}
          onClose={closeModal}
          onBook={() => setModal("booking")}
          onExplore={() => {
            closeModal();
            navigate("discover");
          }}
        />
      )}
      {modal === "booking" && (
        <BookingModal
          state={state}
          update={update}
          L={L}
          onClose={closeModal}
          onFinish={() => {
            closeModal();
            navigate("visit");
          }}
        />
      )}
      {modal === "about" && (
        <Modal
          title={L(
            "一份可亲手体验的未来提案。",
            "A future you can try, today.",
          )}
          eyebrow="THE CONCEPT, HONESTLY"
          onClose={closeModal}
        >
          <div className="about-content">
            <p>
              {L(
                "MAISON ÉDIT 是原创虚构百货品牌的交互演示。商品、价格、库存、楼层与预约都来自结构化演示数据，不连接任何真实百货公司。",
                "MAISON ÉDIT is an original fictional department-store concept. Products, prices, stock, floors and appointments are structured demo data, not connected to a real retailer.",
              )}
            </p>
            <h3>{L("你现在可以体验", "What you can try")}</h3>
            <p>
              {L(
                "个性化编选、筛选搜索、情境导购、到店试穿与体验清单、虚构档案尺码自动匹配、礼赠包装选择、到店安排及演示门店备货同步。所有状态仅保存在当前浏览器。",
                "Personalized edits, search, a contextual demo guide, a store try-on and experience list, automatic fictional-profile sizing, gift wrapping, local visit planning and synchronized demo-store preparation. All state stays in this browser.",
              )}
            </p>
            <h3>{L("关于人物、空间与 AI", "About personas, spaces and AI")}</h3>
            <p>
              {L(
                "封面、默认人物与家为预先生成的虚构参照，人物为普通成年人。不接受私人上传，没有实时试衣或房间重绘。商品图为虚构概念图，尺码与空间建议不保证实际适配。",
                "Editorials and default people and homes are pre-generated fictional references. Test subjects are ordinary adults. No personal uploads, live virtual try-on or room restyling. Product visuals are fictional concepts, and size and space suggestions do not guarantee fit.",
              )}
            </p>
            <p className="notice">
              {L(
                "此版本没有支付、真实预约或真实库存接口。导购回复分别标注本地、Gemini 或临时 OpenAI GPT CLI 测试模式，没有实时生成的试衣或空间效果。",
                "This version has no payment, real booking or live inventory connection. Guide replies identify local, Gemini or temporary OpenAI GPT CLI test mode. No live generated try-on or room scene is provided.",
              )}
            </p>
          </div>
        </Modal>
      )}
      <GuidePanel
        key={`guide-panel:${curatedScenarioFor(state.profile)?.id || "custom"}`}
        open={guideOpen}
        event={guideEvent}
        contextKey={guideContextKey}
        view={view}
        activeModal={!setupConfirmed ? "onboarding" : modal}
        subtitleHost={subtitleHost}
        visitCompanionHost={visitCompanionHost}
        observeKey={feed.map((x) => x.id).join(",")}
        onEvent={signalGuide}
        onOpen={() => setGuideOpen(true)}
        onProduct={(id) => {
          setGuideOpen(false);
          openProduct(byId(id));
        }}
        onEditHistory={() => {
          setGuideOpen(false);
          setModal("history");
        }}
        onBook={() => {
          setGuideOpen(false);
          setModal(state.cart.length ? "booking" : "bag");
        }}
        state={state}
        filters={filters}
        setFilters={setFilters}
        L={L}
        onClose={() => setGuideOpen(false)}
        onAdd={addCart}
        update={update}
        toastIt={toastIt}
        selected={selected}
        serviceStatus={serviceStatus}
        onRefine={() => navigate("discover")}
      />
      {(!setupConfirmed || modal === "onboarding") &&
        createPortal(
          <StoreOnboarding
            language={lang}
            onLanguageChange={() =>
              update((s) => ({
                ...s,
                language: s.language === "zh" ? "en" : "zh",
              }))
            }
            profile={state.profile}
            soundMuted={state.soundMuted}
            L={L}
            onComplete={(profile) => {
              if (!profile || !curatedScenarioFor(profile)) return;
              update((s) => ({
                ...switchCuratedCase(s, curatedScenarioFor(profile).id),
                onboardingStatus: "completed",
              }));
              setSetupConfirmed(true);
              closeModal();
            }}
          />,
          document.body,
        )}
    </div>
  );
}
function VisitEditorial({ L, onVisit }) {
  return (
    <section className="visit-editorial" data-concierge-section="visit">
      <div>
        <p className="eyebrow">FROM DISCOVERY TO A REAL MOMENT</p>
        <h2>
          {L(
            "把屏幕里的喜欢，\n留给一次从容的试选。",
            "Make time for\nsomething beautiful.",
          )}
        </h2>
        <p>
          {L(
            "加入到店尝试清单，按虚构人物模板匹配尺寸，再从容安排一次到店。",
            "Add pieces to your store list, review fictional template sizes, then arrange a visit.",
          )}
        </p>
        <button
          className="button light"
          data-tour-action="plan-visit"
          onClick={onVisit}
        >
          {L("规划到店之旅", "Plan your visit")}
          <Icon name="arrow" size={17} />
        </button>
      </div>
      <div className="visit-image">
        <Picture
          src="/images/architecture-hero.webp"
          alt={L(
            "原创百货空间灵感画面",
            "Original department-store architectural concept",
          )}
          kind="chair"
        />
      </div>
    </section>
  );
}
function StoreFooter({ L, view, setModal, navigate }) {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <div className="footer-wordmark">MAISON ÉDIT</div>
          <p>
            {L(
              "不是更多选择。是更有你的选择。",
              "A considered world, with your point of view.",
            )}
          </p>
        </div>
        <div className="footer-links">
          <button onClick={() => setModal("about")}>
            {L("关于此演示", "About this demo")}
          </button>
          <button onClick={() => setModal("profile")}>
            {L("偏好与隐私", "Preferences & privacy")}
          </button>
          <button
            onClick={() =>
              navigate(view === "merchant" ? "discover" : "merchant")
            }
          >
            {L(
              view === "merchant" ? "回到顾客端" : "商户工作台",
              view === "merchant" ? "Consumer view" : "Merchant studio",
            )}
          </button>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 MAISON ÉDIT · CONCEPT EXPERIENCE</span>
        <span>
          {L(
            "虚构目录与本地演示预约，无真实交易。",
            "Fictional catalog & local demo bookings. No real transactions.",
          )}
        </span>
      </div>
    </footer>
  );
}
function ProductCard({
  item,
  state,
  L,
  onOpen,
  onSave,
  onFeedback,
  index = 0,
  occurrenceId,
  feedPosition,
  onMatch,
}) {
  const isSaved = state.cart.some(
    (line) => line.skuId === item.id && !line.gift?.isGift,
  );
  return (
    <article
      className={`product-card feed-card tone-${index % 3}`}
      data-concierge-product={item.id}
      data-concierge-occurrence={occurrenceId}
      data-feed-position={feedPosition}
      id={`concierge-piece-${occurrenceId || item.id}`}
    >
      <div className="product-visual">
        <PersonalizedScene
          item={item}
          profile={state.profile}
          L={L}
          onOpen={onOpen}
        />
        <OutfitLinks
          item={item}
          state={state}
          L={L}
          onProduct={onMatch || (() => onOpen())}
        />
        <button
          className={`save-button try-list-button ${isSaved ? "saved" : ""}`}
          data-tour-action="try-list"
          data-tour-sku={item.id}
          onClick={onSave}
          aria-label={L(
            isSaved
              ? "已加入到店清单"
              : isTryOnPiece(item)
                ? "加入到店试穿清单"
                : "加入到店体验清单",
            isSaved
              ? "Already in store list"
              : isTryOnPiece(item)
                ? "Add to store try-on list"
                : "Add to store experience list",
          )}
          aria-pressed={isSaved}
        >
          <Icon name={isSaved ? "check" : "plus"} size={15} />
          <span>
            {L(
              isSaved
                ? "已加入到店清单"
                : isTryOnPiece(item)
                  ? "加入到店试穿清单"
                  : "加入到店体验清单",
              isSaved
                ? "In store list"
                : isTryOnPiece(item)
                  ? "Add to store try-on"
                  : "Add to store experience",
            )}
          </span>
        </button>
        {(state.inventory[item.id] ?? 0) === 0 && (
          <span className="stock-tag">
            {L("演示缺货", "DEMO OUT OF STOCK")}
          </span>
        )}
      </div>
      <div className="product-info">
        <div>
          <p className="eyebrow">{item.brand}</p>
          <button className="product-name" onClick={onOpen}>
            {L(item.name, item.en)}
          </button>
          <p className="product-meta">
            {item.color} ·{" "}
            {L(
              item.category === "women"
                ? "女装"
                : item.category === "men"
                  ? "男装"
                  : item.category === "accessories"
                    ? "配饰"
                    : "家居",
              item.category === "women"
                ? "Womenswear"
                : item.category === "men"
                  ? "Menswear"
                  : item.category === "accessories"
                    ? "Accessories"
                    : "Home",
            )}
            {["women", "men"].includes(item.category) &&
              item.category !==
                getPersonaPreset(state.profile.personaId).category && (
                <span className="gift-context-label">
                  {L("送礼灵感 · 自选", "GIFT IDEA · OPTIONAL")}
                </span>
              )}
          </p>
        </div>
        <span className="price">{money(item.price, state.language)}</span>
      </div>
      <div className="product-bottom">
        <span>
          {L(
            ["women", "men"].includes(item.category) &&
              item.category !==
                getPersonaPreset(state.profile.personaId).category
              ? "为送礼保留的灵感"
              : "贴近你的风格",
            ["women", "men"].includes(item.category) &&
              item.category !==
                getPersonaPreset(state.profile.personaId).category
              ? "OPTIONAL GIFT INSPIRATION"
              : "CONSIDERED FOR YOU",
          )}
        </span>
        <div>
          <button
            onClick={() => onFeedback("like")}
            aria-label={L(`更多像${item.name}的风格`, `More like ${item.en}`)}
          >
            {L("更多这样", "More like this")}
          </button>
          <button
            onClick={() => onFeedback("less")}
            aria-label={L(`减少${item.name}推荐`, `Show less of ${item.en}`)}
          >
            {L("少一点", "Less")}
          </button>
        </div>
      </div>
    </article>
  );
}
function EditCard({
  entry,
  state,
  L,
  onSave,
  onAdd,
  onOpen,
  occurrenceId,
  feedPosition,
}) {
  return (
    <article
      className={`edit-card feed-card ${entry.type === "room" ? "room-card" : ""}`}
      data-concierge-products={entry.ids.join(" ")}
      data-concierge-occurrence={occurrenceId}
      data-feed-position={feedPosition}
      id={`concierge-${occurrenceId || entry.id}`}
    >
      <div className="edit-image">
        <Picture
          src={IMAGE[entry.image]}
          alt={L(
            entry.zh + " 原创灵感预览",
            entry.title + " Original editorial preview",
          )}
          position={entry.position}
          kind={entry.type === "room" ? "chair" : "coat"}
          loading="lazy"
        />
        <span className="editorial-image-label">
          {L("原创 AI 灵感画面", "ORIGINAL AI EDITORIAL")}
        </span>
        <button
          className="save-button"
          onClick={onSave}
          aria-label={L("整组加入到店尝试清单", "Add this edit to store list")}
        >
          <Icon name="plus" />
        </button>
      </div>
      <div className="edit-copy">
        <p className="eyebrow">
          {entry.giftIdea
            ? L("送礼灵感 · 自选", "OPTIONAL GIFT INSPIRATION")
            : entry.eyebrow}
        </p>
        <h3>{entry.title}</h3>
        <p>{L(entry.note, entry.enNote)}</p>
        <div className="edit-products">
          {entry.ids.map((id) => {
            const p = byId(id);
            return (
              <button
                key={id}
                onClick={() => onOpen(id)}
                title={L(p.name, p.en)}
              >
                <Picture src={p.image} alt={L(p.name, p.en)} kind={p.kind} />
                <span>{L(p.name, p.en)}</span>
              </button>
            );
          })}
        </div>
        <div className="edit-bottom">
          <span>
            {entry.ids.length} {L("件单品 · 合计", "pieces · Total")}{" "}
            {money(
              entry.ids.reduce((n, id) => n + byId(id).price, 0),
              state.language,
            )}
          </span>
          <button className="line-link" onClick={onAdd}>
            {L("试选这一组", "Try this edit")}
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
function Empty({ L, title, onClick }) {
  return (
    <div className="empty-state">
      <Icon name="heart" size={32} />
      <h3>{title}</h3>
      <p>
        {L(
          "喜欢的灵感，都可以留在这里。",
          "Your favourite discoveries have a place here.",
        )}
      </p>
      <button className="button" onClick={onClick}>
        {L("继续发现", "Keep discovering")}
      </button>
    </div>
  );
}
function ProfileModal({
  state,
  update,
  L,
  onClose,
  toastIt,
  serviceStatus,
  initialTab = "persona",
  onReplay,
}) {
  const [tab, setTab] = useState(initialTab);
  const [historyDraft, setHistoryDraft] = useState(() =>
    sanitizePurchaseHistory(state.purchaseHistory),
  );
  const [historyEdited, setHistoryEdited] = useState(false);
  const [caseDrafts, setCaseDrafts] = useState(state.caseSnapshots || {});
  const [draft, setDraft] = useState({ ...state.profile });
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [floorplanOpen, setFloorplanOpen] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const analysisRequest = useRef(null);
  const alive = useRef(true);
  const persona = getPersonaPreset(draft.personaId);
  const home = getHomePreset(draft.homeId);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      analysisRequest.current?.abort();
    };
  }, []);
  const changeScenario = (patch) => {
    analysisRequest.current?.abort();
    analysisRequest.current = null;
    setAnalysis(null);
    setAnalyzing(false);
    const target = curatedScenarioFor({ ...draft, ...patch });
    if (target && target.id !== curatedScenarioFor(draft)?.id) {
      const next = switchCuratedCase(
        {
          ...state,
          profile: draft,
          purchaseHistory: historyDraft,
          purchaseHistoryOrigin: historyEdited
            ? "edited"
            : state.purchaseHistoryOrigin,
          caseSnapshots: caseDrafts,
        },
        target.id,
      );
      setDraft(next.profile);
      setCaseDrafts(next.caseSnapshots);
      setHistoryDraft(next.purchaseHistory);
      setHistoryEdited(next.purchaseHistoryOrigin === "edited");
    } else setDraft((p) => ({ ...p, ...patch }));
  };
  const analyze = async () => {
    if (
      analyzing ||
      !(
        serviceStatus.analysis === "configured" ||
        serviceStatus.canAttemptAnalysis
      )
    )
      return;
    setAnalyzing(true);
    setAnalysis(null);
    const controller = new AbortController();
    analysisRequest.current = controller;
    const timer = setTimeout(() => controller.abort(), 150000);
    try {
      const response = await fetch(
        import.meta.env.VITE_ANALYSIS_ENDPOINT || "/api/analyze",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            ...presetContext(draft),
            language: state.language,
            consent: { openAI: true },
          }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.reason || "analysis_unavailable");
      if (alive.current && !controller.signal.aborted) setAnalysis(result);
    } catch {
      if (alive.current && !controller.signal.aborted)
        setAnalysis({ mode: "unavailable", analyzed: false });
      else if (alive.current && analysisRequest.current === controller)
        setAnalysis({ mode: "unavailable", analyzed: false });
    } finally {
      clearTimeout(timer);
      if (alive.current) serviceStatus.refresh?.();
      if (alive.current && analysisRequest.current === controller)
        setAnalyzing(false);
    }
  };
  const save = () => {
    if (!draft.name.trim() || !draft.styles.length) {
      setError(
        L(
          "请填写称呼，并至少选择一种风格。",
          "Add a name and select at least one style.",
        ),
      );
      return;
    }
    if (draft.height != null && (draft.height < 100 || draft.height > 220)) {
      setError(
        L(
          "示例身高范围为 100–220 cm。",
          "Use a height between 100 and 220 cm.",
        ),
      );
      return;
    }
    update((s) => ({
      ...switchCuratedCase(s, curatedScenarioFor(draft)?.id),
      caseSnapshots: caseDrafts,
      purchaseHistory: sanitizePurchaseHistory(historyDraft),
      purchaseHistoryOrigin: historyEdited ? "edited" : "seeded",
      profile: { ...draft, name: draft.name.trim() },
    }));
    toastIt(
      L(
        "测试场景与私人编选已更新",
        "Your test scenario and private edit have been updated",
      ),
    );
    onClose();
  };
  return (
    <Modal
      title={L("更了解你一点。", "A little more you.")}
      eyebrow="YOUR PERSONA & YOUR SPACE"
      onClose={onClose}
      wide
    >
      <div className="profile-intro-entry">
        <span>
          {L(
            "人物与空间，随时重新编选。",
            "Your person and your space, always yours to change.",
          )}
        </span>
        <button className="line-link" onClick={onReplay}>
          {L("重新设置测试数据", "Revisit test setup")}
          <Icon name="arrow" size={16} />
        </button>
      </div>
      <div className="profile-tabs">
        {[
          ["persona", L("我的人物", "My persona")],
          ["home", L("我的空间", "My space")],
          ["history", L("购买记录", "Purchase history")],
          ["privacy", L("偏好与数据", "Preferences & data")],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="profile-body">
        {["persona", "home"].includes(tab) && (
          <div className="preset-intro">
            <p className="eyebrow">A FICTIONAL WORLD, READY TO EXPLORE</p>
            <p>
              {L(
                "人物、身形、家和房型都已准备好。直接选一个测试场景，无需上传任何私人照片。",
                "People, body templates, homes and floorplans are ready. Choose a test scenario without uploading any personal photos.",
              )}
            </p>
          </div>
        )}
        {["persona", "home"].includes(tab) && (
          <SceneScenarios
            profile={draft}
            L={L}
            onChange={(profile) => changeScenario(profile)}
          />
        )}
        {tab === "persona" ? (
          <div className="profile-layout">
            <div className="persona-preview">
              <div className="preview-frame">
                <Picture
                  src={persona.image}
                  alt={L(
                    `虚构测试人物：${persona.zh}`,
                    `Fictional test persona: ${persona.en}`,
                  )}
                  kind="shirt"
                />
                <span>
                  {L("预先生成的虚构人物", "PRE-GENERATED FICTIONAL PERSON")}
                </span>
              </div>
              <p className="preset-body-note">
                {L(persona.bodyZh, persona.bodyEn)} · {persona.height} cm ·{" "}
                {L("示例尺码", "Sample size")} {persona.size}
              </p>
              <p className="microcopy">
                {L(
                  "身高与尺码是预设模板，不是从图片测量。不会据此保证合身。",
                  "Height and size are illustrative templates, not measurements inferred from the image. They do not guarantee fit.",
                )}
              </p>
            </div>
            <div className="form-stack">
              <div>
                <span className="field-label">
                  {L("选择默认人物与身形", "Choose a default person & body")}
                </span>
                <div className="persona-options">
                  {personaPresets
                    .filter((p) =>
                      curatedScenarios.some(
                        (scenario) => scenario.personaId === p.id,
                      ),
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`persona-option ${draft.personaId === p.id ? "selected" : ""}`}
                        aria-pressed={draft.personaId === p.id}
                        disabled={
                          !curatedScenarios.some(
                            (scenario) => scenario.personaId === p.id,
                          )
                        }
                        onClick={() => {
                          const scenario = curatedScenarios.find(
                            (entry) => entry.personaId === p.id,
                          );
                          if (scenario)
                            changeScenario({
                              personaId: scenario.personaId,
                              homeId: scenario.homeId,
                              room: scenario.room,
                            });
                        }}
                      >
                        <Picture src={p.image} alt="" kind="shirt" />
                        <span>
                          <strong>{L(p.zh, p.en)}</strong>
                          <small>
                            {L(p.bodyZh, p.bodyEn)} · {p.height} cm · {p.size}
                            {!curatedScenarios.some(
                              (scenario) => scenario.personaId === p.id,
                            ) && (
                              <span className="demo-preset-coming">
                                {L("测试数据待开放", "Test set coming later")}
                              </span>
                            )}
                          </small>
                        </span>
                      </button>
                    ))}
                </div>
              </div>
              <label>
                {L("怎么称呼你", "What should we call you?")}
                <input
                  value={draft.name}
                  maxLength={30}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </label>
              <div className="form-row">
                <label>
                  {L("身高（可选 · cm）", "Height (optional · cm)")}
                  <input
                    type="number"
                    min="100"
                    max="220"
                    value={draft.height ?? ""}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        height:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <div>
                  <span className="field-label">
                    {L("虚构人物匹配尺码", "Fictional template size")}
                  </span>
                  <output className="template-size-output">
                    {draft.size || getPersonaPreset(draft.personaId).size}
                  </output>
                  <small>
                    {L(
                      "随人物模板自动更新，无需手动选择。",
                      "Updates with the selected template; no manual selection needed.",
                    )}
                  </small>
                </div>
              </div>
              <div>
                <span className="field-label">
                  {L("你喜欢的风格", "Your style notes")}
                </span>
                <div className="tags">
                  {styles.map((s) => (
                    <TagButton
                      key={s.id}
                      active={draft.styles.includes(s.id)}
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          styles: p.styles.includes(s.id)
                            ? p.styles.filter((x) => x !== s.id)
                            : [...p.styles, s.id],
                        }))
                      }
                    >
                      {L(s.zh, s.en)}
                    </TagButton>
                  ))}
                </div>
              </div>
              <label>
                {L("编选预算参考", "Your edit budget reference")}
                <span className="range-value">
                  {money(draft.budget, state.language)}
                </span>
                <input
                  type="range"
                  min="1000"
                  max="15000"
                  step="500"
                  value={draft.budget}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, budget: Number(e.target.value) }))
                  }
                />
              </label>
              <p className="notice">
                {L(
                  "预设人物会改变推荐排序与默认尺码。点击保存即可看到新的编选，不会进行身体测量或真实虚拟试衣。",
                  "The preset changes recommendation ranking and default size. Save to see the new edit. No body measurements or real virtual try-on are performed.",
                )}
              </p>
            </div>
          </div>
        ) : tab === "home" ? (
          <div className="profile-layout">
            <div className="persona-preview">
              <div
                className={`preview-frame home-preview ${floorplanOpen ? "floorplan-preview" : ""}`}
              >
                <Picture
                  src={
                    floorplanOpen
                      ? home.floorplan
                      : roomReference(home, draft.room)
                  }
                  alt={
                    floorplanOpen
                      ? L(
                          `${home.zh}的示意房型图`,
                          `Illustrative floorplan: ${home.en}`,
                        )
                      : L(
                          `虚构测试住宅：${home.zh}，${L(...roomNames[draft.room])}`,
                          `Fictional home reference: ${home.en}, ${roomNames[draft.room]?.[1] || "Living room"}`,
                        )
                  }
                  kind="chair"
                />
                <span>
                  {floorplanOpen
                    ? L(
                        "示意房型 · 非真实尺寸",
                        "ILLUSTRATIVE PLAN · NO VERIFIED DIMENSIONS",
                      )
                    : L("预先生成的居家参照", "PRE-GENERATED HOME REFERENCE")}
                </span>
              </div>
              <button
                className="text-link"
                onClick={() => setFloorplanOpen((p) => !p)}
              >
                {floorplanOpen
                  ? L("返回房间照片", "Return to room reference")
                  : L("查看示意房型图", "View illustrative floorplan")}
              </button>
              <p className="microcopy">
                {L(
                  "房间图片与房型图都为虚构测试素材。图中家具不是目录商品，也不是实时生成的改造效果。",
                  "Rooms and plans are fictional test assets. Furniture pictured is not catalog merchandise or a live generated makeover.",
                )}
              </p>
            </div>
            <div className="form-stack">
              <div>
                <span className="field-label">
                  {L("选择默认住宅", "Choose a default home")}
                </span>
                <div className="home-options">
                  {homePresets
                    .filter((h) =>
                      curatedScenarios.some(
                        (scenario) => scenario.homeId === h.id,
                      ),
                    )
                    .map((h) => (
                      <button
                        type="button"
                        className={`home-option ${draft.homeId === h.id ? "selected" : ""}`}
                        key={h.id}
                        aria-pressed={draft.homeId === h.id}
                        disabled={
                          !curatedScenarios.some(
                            (scenario) => scenario.homeId === h.id,
                          )
                        }
                        onClick={() => {
                          const scenario = curatedScenarios.find(
                            (entry) => entry.homeId === h.id,
                          );
                          if (scenario)
                            changeScenario({
                              personaId: scenario.personaId,
                              homeId: scenario.homeId,
                              room: scenario.room,
                            });
                          setFloorplanOpen(false);
                        }}
                      >
                        <Picture src={h.images.living} alt="" kind="chair" />
                        <span>
                          <strong>{L(h.zh, h.en)}</strong>
                          <small>
                            {L(h.noteZh, h.noteEn)}
                            {!curatedScenarios.some(
                              (scenario) => scenario.homeId === h.id,
                            ) && (
                              <span className="demo-preset-coming">
                                {L("测试数据待开放", "Test set coming later")}
                              </span>
                            )}
                          </small>
                        </span>
                      </button>
                    ))}
                </div>
              </div>
              <label>
                {L("想重新编选的空间", "The room on your mind")}
                <select
                  value={draft.room}
                  disabled
                  aria-describedby="demo-room-availability"
                  onChange={(e) => {
                    changeScenario({ room: e.target.value });
                    setFloorplanOpen(false);
                  }}
                >
                  {Object.entries(roomNames).map(([id, names]) => (
                    <option value={id} key={id} disabled={id !== "living"}>
                      {L(...names)}
                      {id !== "living"
                        ? L(" · 测试待开放", " · Coming later")
                        : ""}
                    </option>
                  ))}
                </select>
                <span id="demo-room-availability" className="microcopy">
                  {L(
                    "目前开放四组客厅测试组合。更换人物或住宅会同步选择对应组合。",
                    "Four living-room test sets are available. Changing person or home selects its paired set.",
                  )}
                </span>
              </label>
              <div>
                <span className="field-label">
                  {L("空间色调", "Your space palette")}
                </span>
                <div className="palette-options">
                  {[
                    ["warm", "#c49678", L("温暖自然", "Warm neutrals")],
                    ["blue", "#b9cdd6", L("浅蓝与留白", "Pale blue")],
                    ["artful", "#844450", L("艺术深色", "Artful accents")],
                  ].map(([id, color, label]) => (
                    <button
                      key={id}
                      className={draft.palette === id ? "selected" : ""}
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          palette: id,
                          styles: [
                            ...new Set([
                              ...p.styles,
                              id === "blue"
                                ? "soft"
                                : id === "artful"
                                  ? "artful"
                                  : "warm",
                            ]),
                          ],
                        }))
                      }
                    >
                      <span style={{ background: color }} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="notice">
                {L(
                  "选择房间与喜欢的色调，发现更适合空间的家居搭配。选购前可以量一下摆放位置与门宽，比较家具尺寸。",
                  "Choose your room and favourite palette to explore home pieces for your space. Measure the intended spot and doorway before choosing furniture.",
                )}
              </p>
            </div>
          </div>
        ) : tab === "history" ? (
          <PurchaseHistory
            L={L}
            history={historyDraft}
            onChange={(items) => {
              setHistoryDraft(items);
              setHistoryEdited(true);
            }}
          />
        ) : (
          <div className="privacy-panel">
            <h3>{L("你的数据，只在这里。", "Your data stays here.")}</h3>
            <p>
              {L(
                "档案选择、到店清单、旧版收藏、礼赠偏好与演示预约保存在此浏览器。测试只提供虚构默认素材，不接受私人照片。AI 功能仅在你发起请求时发送所选测试素材和明确说明的上下文。",
                "Profile choices, store-list entries, previous saved pieces, gift preferences and demo bookings stay in this browser. This test uses fictional defaults and accepts no personal photos. AI features send selected test assets and disclosed context only when you start a request.",
              )}
            </p>
            {(state.profile.personaImage || state.profile.homeImage) && (
              <div className="notice">
                <p>
                  {L(
                    "此浏览器先前保存的照片仍保留在本地，不会在默认测试中显示或发送。",
                    "Previously stored photos are still kept in this browser. They are not displayed or sent by the default test.",
                  )}
                </p>
                <button
                  className="text-link"
                  onClick={() => {
                    setDraft((p) => ({
                      ...p,
                      personaImage: null,
                      homeImage: null,
                      consent: false,
                    }));
                    update((s) => ({
                      ...s,
                      profile: {
                        ...s.profile,
                        personaImage: null,
                        homeImage: null,
                        consent: false,
                      },
                    }));
                    toastIt(
                      L(
                        "先前保存的本地照片已移除",
                        "Previously stored local photos removed",
                      ),
                    );
                  }}
                >
                  {L("移除先前保存的照片", "Remove previously stored photos")}
                </button>
              </div>
            )}
            <div className="privacy-stat">
              <span>
                {state.cart.length} {L("款到店选款", "store-list pieces")}
              </span>
              <span>
                {state.bookings.length} {L("次演示预约", "demo bookings")}
              </span>
              <span>
                {Object.keys(state.feedback).length}{" "}
                {L("项偏好反馈", "preference signals")}
              </span>
            </div>
            <button
              className="button secondary"
              onClick={() => {
                update((s) => ({ ...s, feedback: {} }));
                toastIt(L("推荐反馈已重置", "Recommendation feedback reset"));
              }}
            >
              {L("重置推荐反馈", "Reset recommendation feedback")}
            </button>
            <button
              className="button danger"
              onClick={() => setDeleteConfirm(true)}
            >
              <Icon name="trash" size={16} />
              {L("删除此浏览器的全部演示数据", "Delete all local demo data")}
            </button>
            {deleteConfirm && (
              <div className="delete-confirm" role="alert">
                <p>
                  {L(
                    "这会删除档案、到店清单、旧版收藏和演示预约，无法从此页面恢复。确认删除？",
                    "This removes profile choices, saved pieces and bookings. This page cannot restore them. Delete all?",
                  )}
                </p>
                <button
                  className="button danger"
                  onClick={() => {
                    localStorage.removeItem(STORAGE_KEY);
                    resetAllGuidedCases();
                    clearVisitPlanningSessions();
                    update(initialState());
                    toastIt(
                      L("本地演示数据已清除", "All local demo data cleared"),
                    );
                    onClose();
                  }}
                >
                  {L("确认删除", "Confirm deletion")}
                </button>
                <button
                  className="text-link"
                  onClick={() => setDeleteConfirm(false)}
                >
                  {L("保留数据", "Keep data")}
                </button>
              </div>
            )}
          </div>
        )}
        {["persona", "home"].includes(tab) && (
          <section className="preset-analysis">
            <div>
              <p className="eyebrow">A SECOND POINT OF VIEW</p>
              <h3>
                {L(
                  "让 AI 看看这个测试场景",
                  "Let AI consider this test scenario",
                )}
              </h3>
              <p>
                {L(
                  "仅发送所选的虚构人物、房间图片与房型信息至 OpenAI 测试后端；不会发送称呼、手动身高或私人照片。AI 分析与视觉生成分别标明状态。",
                  "Only the selected fictional person, room references and floorplan information go to the OpenAI test backend. Your name, manual height and personal photos are not sent. Analysis and image generation are labeled separately.",
                )}
              </p>
            </div>
            <button
              className="button secondary"
              disabled={
                analyzing ||
                !(
                  serviceStatus.analysis === "configured" ||
                  serviceStatus.canAttemptAnalysis
                )
              }
              onClick={analyze}
            >
              {analyzing
                ? L("分析中…", "Analyzing…")
                : serviceStatus.canAttemptAnalysis &&
                    serviceStatus.analysis !== "configured"
                  ? L(
                      "测试 AI 连接与默认场景",
                      "Test AI connection with defaults",
                    )
                  : L("分析所选默认场景", "Analyze selected defaults")}
            </button>
            {serviceStatus.analysis !== "configured" &&
              !serviceStatus.canAttemptAnalysis && (
                <p className="notice">
                  {L(
                    "AI 分析后端当前未就绪。你可以完整测试默认选择、图片参照、推荐和到店流程；没有产生真实 AI 分析。",
                    "The AI analysis backend is not ready. Default choices, visual references, recommendations and visit flows are fully testable. No live AI analysis has been produced.",
                  )}
                </p>
              )}
            {analyzing && (
              <p role="status">
                {L(
                  "正在请求测试 AI，关闭窗口会取消请求。",
                  "Requesting the test AI. Closing this window cancels the request.",
                )}
              </p>
            )}
            {analysis && (
              <div className="analysis-result" role="status">
                {analysis.analyzed &&
                ["codex-cli", "gemini"].includes(analysis.mode) ? (
                  <>
                    <span className="eyebrow">
                      {analysis.mode === "codex-cli"
                        ? "OPENAI · GPT CLI TEST ANALYSIS"
                        : "GEMINI · TEST ANALYSIS"}
                    </span>
                    <p>{analysis.summary}</p>
                    {analysis.observations?.length > 0 && (
                      <ul>
                        {analysis.observations.map((o, i) => (
                          <li key={i}>{o.text}</li>
                        ))}
                      </ul>
                    )}
                    <p className="microcopy">
                      {analysis.disclosure ||
                        L(
                          "AI 对虚构素材的分析可能不准确，不能用来测量尺寸或确认合身。",
                          "AI analysis of fictional references may be inaccurate. It cannot establish measurements or fit.",
                        )}
                    </p>
                    {analysis.styleTags?.some((id) =>
                      styles.some((s) => s.id === id),
                    ) && (
                      <button
                        className="text-link"
                        onClick={() => {
                          setDraft((p) => ({
                            ...p,
                            styles: analysis.styleTags.filter((id) =>
                              styles.some((s) => s.id === id),
                            ),
                          }));
                          toastIt(
                            L(
                              "AI 风格已加入草稿，保存后生效",
                              "AI style tags added to your draft. Save to apply.",
                            ),
                          );
                        }}
                      >
                        {L("采用 AI 风格建议", "Apply AI style suggestions")}
                      </button>
                    )}
                  </>
                ) : (
                  <p>
                    {L(
                      "AI 分析暂时不可用。所选默认场景、推荐排序和示意房型仍可完整测试。没有把预设描述标成 AI 分析。",
                      "AI analysis is currently unavailable. Selected defaults, ranking and illustrative plans still work. No AI analysis has been produced.",
                    )}
                  </p>
                )}
              </div>
            )}
            <p className="microcopy">
              {L(
                "照片为预先生成的原始测试参照。当前未提供实时试衣或房间重绘；推荐商品清单会随场景变化。",
                "Photos are pre-generated test references. Live try-on and room restyling are not available; recommended pieces change with your scenario.",
              )}
            </p>
          </section>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-actions">
        <span>
          {L(
            "虚构默认场景 · 无需上传",
            "FICTIONAL DEFAULTS · NO UPLOAD NEEDED",
          )}
        </span>
        <button className="button" onClick={save}>
          {L("保存，更新我的编选", "Save & refine my edit")}
          <Icon name="arrow" size={17} />
        </button>
      </div>
    </Modal>
  );
}
function ProductModal({
  item,
  state,
  L,
  onClose,
  onAdd,
  onSave,
  onAlternative,
  onVariant,
  subtitleHostRef,
}) {
  const [color, setColor] = useState(item.color);
  const [quantity, setQuantity] = useState(1);
  const [gift, setGift] = useState(null);
  useEffect(() => {
    setColor(item.color);
    setQuantity(1);
    setGift(null);
  }, [item.id]);
  const matchedVariant = tryListVariant(item, state.profile, gift);
  const size = matchedVariant.size;
  const variantChanged = (patch) => {
    const variant = { size, color, ...patch };
    if (patch.color) setColor(patch.color);
    onVariant?.({
      type: "variant",
      productId: item.id,
      variant,
      fit: matchedVariant.fit,
      gift: normalizeGift(gift),
      giftPending: Boolean(gift && matchedVariant.fit.status === "pending"),
      value: `${variant.size}/${variant.color}`,
    });
  };
  const alternative = cheaperAlternative(item.id, state.inventory);
  const stock = state.inventory[item.id] ?? 0;
  return (
    <Modal
      title={L(item.name, item.en)}
      conciergeProductId={item.id}
      eyebrow={item.brand}
      onClose={onClose}
      wide
    >
      <div className="product-detail">
        <div className="detail-visual">
          <PersonalizedScene
            item={{ ...item, color }}
            profile={state.profile}
            gift={gift}
            L={L}
            onOpen={() => {}}
          />
          <OutfitLinks
            item={{ ...item, color }}
            gift={gift}
            state={state}
            L={L}
            onProduct={onAlternative}
          />
          <span>
            {L(
              "原创商品概念图，非真实 SKU 实拍",
              "ORIGINAL CONCEPT · NOT AN ACTUAL SKU PHOTOGRAPH",
            )}
          </span>
        </div>
        <div className="detail-info">
          <p className="detail-price">{money(item.price, state.language)}</p>
          <p>
            {L(
              item.description,
              "An original fictional piece in the MAISON ÉDIT demo catalog. Concept imagery, price and stock are demo data, not a real product listing.",
            )}
          </p>
          <p className="sku-line">
            {item.id} ·{" "}
            {L(
              `${item.floor} 楼 · ${item.counter} 专柜`,
              `Floor ${item.floor} · Counter ${item.counter}`,
            )}
          </p>
          <div className="product-concierge-slot" ref={subtitleHostRef} />
          <section
            className="automatic-fit"
            data-auto-fit={matchedVariant.fit.status}
          >
            <span className="field-label">
              {L(
                isTryOnPiece(item) ? "为你匹配的到店试穿尺码" : "到店体验",
                isTryOnPiece(item)
                  ? "Your matched store try-on size"
                  : "Store experience",
              )}
            </span>
            <strong>
              {tryListSizeLabel({ size, fit: matchedVariant.fit, gift }, L)}
            </strong>
            <p>
              {L(
                gift?.isGift
                  ? "礼物仅参考受赠人提供的尺码；未知时由门店确认，不套用你的尺码。"
                  : "按所选虚构人物的固定衣码／鞋码模板自动匹配，无需手动选择。非照片测量或真实合身保证。",
                gift?.isGift
                  ? "Gifts use the recipient’s supplied size. Unknown sizes await the store; your own size is never used."
                  : "Automatically matched from the selected fictional person’s fixed clothing/shoe template. No manual size selection, image measurement or real fit guarantee.",
              )}
            </p>
          </section>
          <div>
            <span className="field-label">{L("颜色", "Colour")}</span>
            <div className="tags">
              {item.colors.map((c) => (
                <TagButton
                  key={c}
                  active={color === c}
                  onClick={() => variantChanged({ color: c })}
                >
                  {c}
                </TagButton>
              ))}
            </div>
          </div>
          <label className="quantity-field">
            {L("数量", "Quantity")}
            <input
              type="number"
              min="1"
              max={Math.max(stock, 1)}
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  Math.min(
                    Math.max(1, Math.floor(Number(e.target.value) || 1)),
                    Math.max(stock, 1),
                  ),
                )
              }
            />
          </label>
          <GiftPackagingEditor
            value={gift}
            sizes={tryListRecipientSizes(item)}
            L={L}
            onChange={(next) => {
              setGift(next);
              if (
                Boolean(next) !== Boolean(gift) ||
                [
                  "packagingId",
                  "occasion",
                  "recipientSize",
                  "includeCard",
                ].some((key) => next?.[key] !== gift?.[key])
              ) {
                onVariant?.({
                  type: "gift",
                  productId: item.id,
                  gift: normalizeGift(next),
                  value: next ? "gift" : "self",
                });
              }
            }}
          />
          <p className="availability">
            <span
              className={`availability-dot ${stock ? "" : "unavailable"}`}
            />
            {stock
              ? L(
                  `演示库存：${stock} 件，加入清单后提交本地备货请求`,
                  `Demo stock: ${stock}. Add to the store list to request local demo preparation.`,
                )
              : L(
                  "演示缺货，可以查看替代款",
                  "Out of stock in this demo. Explore an alternative.",
                )}
          </p>
          <button
            className="button"
            data-tour-action="add-bag"
            data-tour-sku={item.id}
            disabled={!stock}
            onClick={() => onAdd(item.id, size, color, quantity, gift)}
          >
            <Icon name="bag" size={17} />
            {item.category === "women" ||
            item.category === "men" ||
            item.kind === "shoe"
              ? L("加入到店试穿清单", "Add to store try-on list")
              : L("加入到店体验清单", "Add to store experience list")}
          </button>
          {state.cart.some((line) => line.skuId === item.id) && (
            <button
              className="button secondary"
              data-tour-action="review-list"
              data-tour-sku={item.id}
              onClick={() =>
                onVariant?.({
                  type: "variant",
                  productId: item.id,
                  variant: { size, color },
                  fit: matchedVariant.fit,
                  value: "try-list-reviewed",
                })
              }
            >
              <Icon name="check" size={17} />
              {L(
                "已核对自动匹配与备货请求",
                "Review matched size & preparation",
              )}
            </button>
          )}
          {alternative && (
            <button
              className="alternative-button"
              onClick={() => onAlternative(alternative.id)}
            >
              <span>
                {L("更轻盈的预算选择", "A lighter budget alternative")}
                <strong>{L(alternative.name, alternative.en)}</strong>
              </span>
              <span>
                {money(alternative.price, state.language)}
                <Icon name="arrow" size={15} />
              </span>
            </button>
          )}
          <p className="microcopy">
            {L(
              "概念图可由多件演示商品共用，不代表具体颜色或细节。清单不是购买，无需支付；尺码需真实试穿确认。",
              "Concept visuals may be shared by demo pieces and do not represent a specific colour or detail. No purchase or payment. Size requires a real fitting.",
            )}
          </p>
        </div>
      </div>
    </Modal>
  );
}
function BagModal({ state, update, L, onClose, onBook, onExplore }) {
  const remove = (id) =>
    update((s) => ({ ...s, cart: s.cart.filter((x) => x.lineId !== id) }));
  const total = sumItems(state.cart);
  return (
    <Modal
      title={L("到店试穿与体验清单", "Your store try-on & experience list")}
      eyebrow="THE STORE LIST"
      onClose={onClose}
      drawer
    >
      {state.cart.length ? (
        <>
          <div className="bag-items">
            {state.cart.map((line) => {
              const p = byId(line.skuId);
              return (
                <article className="bag-item" key={line.lineId}>
                  <Picture src={p.image} alt={L(p.name, p.en)} kind={p.kind} />
                  <div>
                    <p className="eyebrow">{p.brand}</p>
                    <h3>{L(p.name, p.en)}</h3>
                    <p>
                      {tryListSizeLabel(line, L)} · {line.color}
                    </p>
                    <p className="try-list-preparation" role="status">
                      {tryListPreparationLabel(line, L)}
                    </p>
                    <strong>{money(p.price, state.language)}</strong>
                    <GiftSummary value={line.gift} L={L} />
                    <details className="bag-gift-edit">
                      <summary>
                        {L(
                          line.gift ? "调整礼赠与包装" : "把它作为礼物",
                          line.gift
                            ? "Edit gifting & wrapping"
                            : "Make it a gift",
                        )}
                      </summary>
                      <GiftPackagingEditor
                        value={line.gift}
                        sizes={tryListRecipientSizes(p)}
                        L={L}
                        compact
                        onChange={(value) =>
                          update((s) => ({
                            ...s,
                            cart: s.cart.map((x) => {
                              if (x.lineId !== line.lineId) return x;
                              const gift = normalizeGift(value);
                              const variant = tryListVariant(
                                p,
                                s.profile,
                                gift,
                              );
                              const next = {
                                ...x,
                                size: variant.size,
                                fit: variant.fit,
                                preparation: {
                                  status: "pending",
                                  submittedAt: new Date().toISOString(),
                                },
                              };
                              if (gift) next.gift = gift;
                              else delete next.gift;
                              return next;
                            }),
                          }))
                        }
                      />
                    </details>
                    <div className="bag-quantity">
                      <button
                        className="icon-button"
                        aria-label={L("减少数量", "Decrease quantity")}
                        disabled={line.quantity === 1}
                        onClick={() =>
                          update((s) => ({
                            ...s,
                            cart: s.cart.map((x) =>
                              x.lineId === line.lineId
                                ? { ...x, quantity: x.quantity - 1 }
                                : x,
                            ),
                          }))
                        }
                      >
                        <Icon name="minus" size={14} />
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        className="icon-button"
                        aria-label={L("增加数量", "Increase quantity")}
                        disabled={
                          skuQuantity(state.cart, p.id) >=
                          (state.inventory[p.id] ?? 0)
                        }
                        onClick={() =>
                          update((s) => ({
                            ...s,
                            cart: s.cart.map((x) =>
                              x.lineId === line.lineId
                                ? { ...x, quantity: x.quantity + 1 }
                                : x,
                            ),
                          }))
                        }
                      >
                        <Icon name="plus" size={14} />
                      </button>
                      <button
                        className="text-link"
                        onClick={() => remove(line.lineId)}
                      >
                        {L("移除", "Remove")}
                      </button>
                    </div>
                    {(state.inventory[p.id] ?? 0) <
                      skuQuantity(state.cart, p.id) && (
                      <span className="form-error">
                        {L(
                          "库存已变更，请移除或选择替代款",
                          "Stock changed. Remove or choose an alternative.",
                        )}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="bag-summary">
            <div>
              <span>{L("试选清单参考总价", "Indicative edit total")}</span>
              <strong>{money(total, state.language)}</strong>
            </div>
            <p>
              {L(
                "仅作选品参考，不收取款项。预约不会锁定真实库存。",
                "For your consideration only. No charge. Bookings do not reserve real stock.",
              )}
            </p>
            <button
              className="button"
              onClick={onBook}
              disabled={cartUnavailable(state.cart, state.inventory)}
            >
              {L("安排私人到店", "Arrange a private visit")}
              <Icon name="arrow" size={17} />
            </button>
            <button className="text-link" onClick={onExplore}>
              {L("继续编选", "Keep editing")}
            </button>
          </div>
        </>
      ) : (
        <Empty
          L={L}
          title={L(
            "从喜欢的一件，开始到店之旅。",
            "A visit begins with one beautiful piece.",
          )}
          onClick={onExplore}
        />
      )}
    </Modal>
  );
}
function BookingModal({ state, update, L, onClose, onFinish }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [form, setForm] = useState({
    date: dateStr(tomorrow),
    time: "11:00",
    name: state.profile.name,
    sharedFields: {
      name: true,
      items: true,
      dateTime: true,
      styles: false,
      height: false,
      room: false,
    },
  });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(null);
  const [working, setWorking] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!state.cart.length) {
      setError(
        L("请先把单品加入到店清单。", "Add a piece to your visit bag first."),
      );
      return;
    }
    if (!agreed) {
      setError(
        L(
          "请确认这只是本地演示预约。",
          "Please acknowledge that this is a local demo booking.",
        ),
      );
      return;
    }
    if (!form.name.trim()) {
      setError(L("请填写预约称呼。", "Add a booking name."));
      return;
    }
    if (new Date(`${form.date}T${form.time}`) <= new Date()) {
      setError(L("请选择未来的日期与时间。", "Choose a future date and time."));
      return;
    }
    if (cartUnavailable(state.cart, state.inventory)) {
      setError(
        L(
          "演示库存已变更，请返回清单调整。",
          "Demo stock changed. Adjust your visit bag.",
        ),
      );
      return;
    }
    setWorking(true);
    await new Promise((r) => setTimeout(r, 450));
    if (!mounted.current) return;
    const booking = {
      ...makeBooking(state.cart, form),
      sharedSnapshot: {
        styles: form.sharedFields.styles ? state.profile.styles : [],
        height: form.sharedFields.height ? state.profile.height : null,
        room: form.sharedFields.room ? state.profile.room : null,
      },
    };
    update((s) => ({ ...s, bookings: [booking, ...s.bookings], cart: [] }));
    setConfirmed(booking);
    setWorking(false);
  };
  return (
    <Modal
      title={L(
        confirmed ? "这次相遇，已写入演示。" : "给喜欢的事物，留一点时间。",
        confirmed ? "Your demo visit is in the diary." : "Make a little time.",
      )}
      eyebrow="A PRIVATE VISIT"
      onClose={onClose}
    >
      {confirmed ? (
        <div className="booking-success">
          <span className="success-seal">
            <Icon name="check" size={35} />
          </span>
          <h3>{L("演示预约已确认", "Local demo booking confirmed")}</h3>
          <p>
            {confirmed.date} · {confirmed.time}
          </p>
          <p>{confirmed.id}</p>
          <p className="notice">
            {L(
              "没有联系真实门店，也没有锁定真实库存。可在商户工作台模拟备货，再回到到店之旅查看变化。",
              "No real store was contacted and no stock was reserved. Try preparation in the merchant studio, then see the update in Your visit.",
            )}
          </p>
          <button className="button" onClick={onFinish}>
            {L("查看清单与路线", "View itinerary & route")}
            <Icon name="arrow" size={17} />
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="booking-form">
          <p>
            {L(
              "选择日期和时间，为这份清单安排一次 45 分钟的私人试选演示。",
              "Choose a date and time for a 45-minute private fitting demo.",
            )}
          </p>
          <div className="form-row">
            <label>
              {L("日期（设备本地时间）", "Date (device local time)")}
              <input
                type="date"
                required
                min={dateStr(new Date())}
                value={form.date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
              />
            </label>
            <label>
              {L("时间", "Time")}
              <select
                value={form.time}
                onChange={(e) =>
                  setForm((p) => ({ ...p, time: e.target.value }))
                }
              >
                {[
                  "10:00",
                  "11:00",
                  "12:00",
                  "14:00",
                  "15:00",
                  "16:00",
                  "17:00",
                  "18:00",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {L("预约称呼", "Booking name")}
            <input
              required
              maxLength={30}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <h3>
            {L("演示商户可看到哪些字段？", "What will the demo merchant see?")}
          </h3>
          <p className="microcopy">
            {L(
              "这里只同步到此浏览器内的商户工作台，不会对外发送。必需字段：称呼、选款（规格/数量与已填写的礼赠偏好）、时间。照片从不共享。",
              "Shared only with the merchant studio in this browser, never externally. Required: name, pieces (variants/quantities and any gift preferences you added), and visit time. Photos are never shared.",
            )}
          </p>
          {[
            ["name", L("预约称呼", "Booking name")],
            [
              "items",
              L(
                "选款、尺码、颜色与数量",
                "Pieces, sizes, colours and quantities",
              ),
            ],
            ["dateTime", L("日期与时间", "Date and time")],
            ["styles", L("风格偏好（可选）", "Style preferences (optional)")],
            ["height", L("身高参考（可选）", "Height reference (optional)")],
            ["room", L("空间类型（可选）", "Room type (optional)")],
          ].map(([id, label]) => (
            <label key={id} className="checkbox-line">
              <input
                type="checkbox"
                checked={form.sharedFields[id]}
                disabled={["name", "items", "dateTime"].includes(id)}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    sharedFields: { ...p.sharedFields, [id]: e.target.checked },
                  }))
                }
              />
              {label}
            </label>
          ))}
          <div className="booking-items-summary">
            {state.cart.map((x) => (
              <div key={x.lineId}>
                <span>
                  {L(byId(x.skuId).name, byId(x.skuId).en)} ·{" "}
                  {tryListSizeLabel(x, L)} · {x.color} × {x.quantity}
                </span>
                <GiftSummary value={x.gift} L={L} />
              </div>
            ))}
          </div>
          <label className="checkbox-line consent">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>
              {L(
                "我了解这是本地演示，不是真实门店预约，不会收费。",
                "I understand this is a local demo, not a real store appointment. There is no charge.",
              )}
            </span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button"
            type="submit"
            disabled={working || !state.cart.length}
          >
            {working
              ? L("写入本地演示…", "Saving local demo…")
              : L("确认演示预约", "Confirm demo visit")}
            <Icon name="arrow" size={17} />
          </button>
        </form>
      )}
    </Modal>
  );
}
const statusLabel = (status, L) =>
  status === "ready"
    ? L("已备好", "Ready")
    : status === "unavailable"
      ? L("缺货替代", "Alternative needed")
      : L("待确认", "Awaiting preparation");
function VisitPage({
  state,
  L,
  onBook,
  onBag,
  onExplore,
  onProduct,
  companionHostRef,
  serviceStatus,
  update,
  toastIt,
}) {
  useLayoutEffect(() => {
    const header = document.querySelector(".site-header");
    const shell = document.querySelector(".storefront-shell");
    const placeUtilities = () => {
      if (header && shell)
        shell.style.setProperty(
          "--visit-utility-top",
          `${header.getBoundingClientRect().bottom + scrollY + 14}px`,
        );
    };
    placeUtilities();
    const observer = new ResizeObserver(placeUtilities);
    if (header) observer.observe(header);
    window.addEventListener("resize", placeUtilities);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", placeUtilities);
      shell?.style.removeProperty("--visit-utility-top");
    };
  }, []);
  const changeBooking = (bookingId, lineId, alt) => {
    const booking = state.bookings.find((b) => b.id === bookingId);
    const line = booking?.items.find((x) => x.lineId === lineId);
    if (
      !line ||
      !byId(alt) ||
      (state.inventory[alt] ?? 0) <
        skuQuantity(
          booking.items.filter((x) => x.lineId !== lineId),
          alt,
        ) +
          line.quantity
    ) {
      toastIt(
        L(
          "替代款库存已变更，暂时无法采用，请等待新的备货建议",
          "Alternative stock changed. It cannot be accepted; wait for a new preparation suggestion.",
        ),
      );
      return;
    }
    update((s) => ({
      ...s,
      bookings: s.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              items: b.items.map((x) =>
                x.lineId === lineId
                  ? {
                      ...x,
                      skuId: alt,
                      size: byId(alt).sizes.includes(x.size)
                        ? x.size
                        : byId(alt).sizes[0],
                      color: byId(alt).color,
                      status: "pending",
                      alternativeId: null,
                    }
                  : x,
              ),
            }
          : b,
      ),
    }));
    toastIt(
      L(
        "替代款已采用，等待演示商户备货",
        "Alternative accepted, awaiting demo preparation",
      ),
    );
  };
  return (
    <section className="page-section visit-page">
      <div className="visit-utility-reserve" aria-hidden="true" />
      <VisitJourneyShowcase
        key={state.profile.personaId}
        serviceStatus={serviceStatus}
        state={state}
        L={L}
        onBook={onBook}
        onBag={onBag}
        onExplore={onExplore}
        onProduct={onProduct}
      />
      {state.bookings.length > 0 && (
        <section
          className="visit-bookings"
          aria-label={L("已保存的演示预约", "Saved demo visits")}
        >
          <h2>{L("已保存的演示预约", "Your saved demo visits")}</h2>
          {state.bookings.map((b) => (
            <article
              className={`booking-card ${b.status === "cancelled" ? "cancelled" : ""}`}
              key={b.id}
            >
              <header>
                <div>
                  <p className="eyebrow">{b.id}</p>
                  <h2>
                    {b.date} <span>{b.time}</span>
                  </h2>
                  <p>
                    {b.name} ·{" "}
                    {L("45 分钟私人试选演示", "45-minute private fitting demo")}
                  </p>
                </div>
                <span className="status-pill">
                  {L(
                    b.status === "cancelled" ? "已取消" : "演示预约已确认",
                    b.status === "cancelled" ? "Cancelled" : "Demo confirmed",
                  )}
                </span>
              </header>
              <div className="booking-lines">
                {b.items.map((line) => {
                  const p = byId(line.skuId),
                    alt = byId(line.alternativeId);
                  return (
                    <div className="booking-line" key={line.lineId}>
                      <Picture
                        src={p.image}
                        alt={L(p.name, p.en)}
                        kind={p.kind}
                      />
                      <div>
                        <strong>{L(p.name, p.en)}</strong>
                        <p>
                          {tryListSizeLabel(line, L)} · {line.color} ×{" "}
                          {line.quantity}
                        </p>
                        <GiftSummary value={line.gift} L={L} />
                        <span>
                          {L(
                            `${p.floor} 楼 · ${p.counter} 专柜`,
                            `Floor ${p.floor} · Counter ${p.counter}`,
                          )}
                        </span>
                        {alt && (
                          <div className="replacement-note">
                            <p>
                              {L("建议替代", "Suggested alternative")}:{" "}
                              {L(alt.name, alt.en)} ·{" "}
                              {money(alt.price, state.language)}
                            </p>
                            {b.status !== "cancelled" && (
                              <button
                                className="text-link"
                                onClick={() =>
                                  changeBooking(b.id, line.lineId, alt.id)
                                }
                              >
                                {L("采用替代款", "Accept alternative")}
                                <Icon name="arrow" size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <span className={`prep-status ${line.status}`}>
                        {statusLabel(line.status, L)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="booking-card-foot">
                <span>
                  {L("共享字段", "Shared fields")}:{" "}
                  {Object.entries(b.sharedFields)
                    .filter(([, v]) => v)
                    .map(
                      ([k]) =>
                        ({
                          name: L("称呼", "Name"),
                          items: L("选款与规格", "Pieces & variants"),
                          dateTime: L("时间", "Time"),
                          styles: L("风格", "Styles"),
                          height: L("身高", "Height"),
                          room: L("空间", "Room"),
                        })[k],
                    )
                    .join(" · ")}
                </span>
                {b.status !== "cancelled" && (
                  <button
                    className="text-link"
                    onClick={() => {
                      update((s) => ({
                        ...s,
                        bookings: s.bookings.map((x) =>
                          x.id === b.id ? { ...x, status: "cancelled" } : x,
                        ),
                      }));
                      toastIt(
                        L("本地演示预约已取消", "Local demo visit cancelled"),
                      );
                    }}
                  >
                    {L("取消演示预约", "Cancel demo visit")}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
function MerchantConsole({ state, update, L, toastIt, onPreparation }) {
  const [tab, setTab] = useState("bookings");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [quantity, setQuantity] = useState(0);
  const active = state.bookings.filter((b) => b.status !== "cancelled");
  const setPrep = (bookingId, lineId, status) => {
    const line = state.bookings
      .find((booking) => booking.id === bookingId)
      ?.items.find((entry) => entry.lineId === lineId);
    if (
      !line ||
      (status === "ready" &&
        (!["matched", "not-required"].includes(line.fit?.status) ||
          (line.gift?.isGift &&
            !line.gift.recipientSize &&
            line.fit?.kind !== "experience")))
    )
      return;
    update((s) => ({
      ...s,
      bookings: s.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              items: b.items.map((i) =>
                i.lineId === lineId
                  ? {
                      ...i,
                      status,
                      preparation: {
                        ...i.preparation,
                        status,
                        acknowledgedAt: new Date().toISOString(),
                      },
                      alternativeId:
                        status === "unavailable"
                          ? cheaperAlternative(i.skuId, s.inventory)?.id || null
                          : null,
                    }
                  : i,
              ),
            }
          : b,
      ),
    }));
    onPreparation?.({
      type: "preparation",
      productId: line.skuId,
      fit: line.fit,
      gift: line.gift,
      preparation: { status },
      variant: { size: line.size, color: line.color },
      value: `${lineId}:${status}`,
    });
  };
  return (
    <section className="page-section merchant-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MAISON ÉDIT / MERCHANT STUDIO</p>
          <h1>{L("为每一次相遇，提前准备。", "Prepare for every arrival.")}</h1>
          <p>
            {L(
              "演示商户端，与顾客端共享此浏览器内的状态。无需登录，无远程权限。",
              "Demo merchant view, sharing this browser’s local state with the consumer view. No login or remote access.",
            )}
          </p>
        </div>
        <span className="demo-tag">{L("本地沙盒", "LOCAL SANDBOX")}</span>
      </div>
      <TryListPreparation
        state={state}
        update={update}
        L={L}
        onStatus={onPreparation}
      />
      <div className="merchant-stats">
        <div>
          <span>{L("有效演示预约", "Active demo visits")}</span>
          <strong>{active.length.toString().padStart(2, "0")}</strong>
        </div>
        <div>
          <span>{L("待准备单品", "Awaiting preparation")}</span>
          <strong>
            {active
              .reduce(
                (n, b) =>
                  n + b.items.filter((i) => i.status === "pending").length,
                0,
              )
              .toString()
              .padStart(2, "0")}
          </strong>
        </div>
        <div>
          <span>{L("演示目录单品", "Demo catalog pieces")}</span>
          <strong>{catalog.length}</strong>
        </div>
        <div>
          <span>{L("缺货单品", "Out-of-stock pieces")}</span>
          <strong>
            {catalog
              .filter((p) => !state.inventory[p.id])
              .length.toString()
              .padStart(2, "0")}
          </strong>
        </div>
      </div>
      <div className="profile-tabs">
        <button
          className={tab === "bookings" ? "active" : ""}
          onClick={() => setTab("bookings")}
        >
          {L("预约与备货", "Visits & preparation")}
        </button>
        <button
          className={tab === "catalog" ? "active" : ""}
          onClick={() => setTab("catalog")}
        >
          {L("商品与库存", "Catalog & inventory")}
        </button>
      </div>
      {tab === "bookings" ? (
        <div className="merchant-bookings">
          {state.bookings.length ? (
            state.bookings.map((b) => (
              <article className="merchant-booking" key={b.id}>
                <header>
                  <div>
                    <p className="eyebrow">{b.id}</p>
                    <h2>
                      {b.name} · {b.date} / {b.time}
                    </h2>
                  </div>
                  <span className="status-pill">
                    {L(
                      b.status === "cancelled" ? "已取消" : "演示确认",
                      b.status === "cancelled" ? "Cancelled" : "Demo confirmed",
                    )}
                  </span>
                </header>
                <p className="shared-info">
                  {L(
                    "仅显示顾客确认共享的字段",
                    "Only fields approved for this local demo",
                  )}
                  :{" "}
                  {b.sharedSnapshot?.styles?.length
                    ? `${L("风格", "Styles")}: ${b.sharedSnapshot.styles.join(", ")} · `
                    : ""}
                  {b.sharedSnapshot?.height
                    ? `${L("身高", "Height")}: ${b.sharedSnapshot.height} cm · `
                    : ""}
                  {b.sharedSnapshot?.room
                    ? `${L("空间", "Room")}: ${b.sharedSnapshot.room}`
                    : ""}
                  {!b.sharedSnapshot?.styles?.length &&
                  !b.sharedSnapshot?.height &&
                  !b.sharedSnapshot?.room
                    ? L(
                        "未共享可选档案字段",
                        "No optional profile fields shared",
                      )
                    : ""}
                </p>
                {b.items.map((i) => {
                  const p = byId(i.skuId);
                  return (
                    <div className="merchant-prep-line" key={i.lineId}>
                      <Picture
                        src={p.image}
                        alt={L(p.name, p.en)}
                        kind={p.kind}
                      />
                      <div>
                        <strong>{L(p.name, p.en)}</strong>
                        <p>
                          {i.skuId} · {tryListSizeLabel(i, L)} · {i.color} ×{" "}
                          {i.quantity} · {p.counter}
                        </p>
                        <GiftSummary value={i.gift} L={L} />
                      </div>
                      <label>
                        {L("准备状态", "Preparation status")}
                        <select
                          aria-label={L(
                            `${p.name}准备状态`,
                            `${p.en} preparation status`,
                          )}
                          value={i.status}
                          disabled={b.status === "cancelled"}
                          onChange={(e) => {
                            setPrep(b.id, i.lineId, e.target.value);
                            toastIt(
                              L(
                                "状态已同步到顾客到店之旅",
                                "Status updated in the consumer itinerary",
                              ),
                            );
                          }}
                        >
                          <option value="pending">
                            {L("待确认", "Awaiting preparation")}
                          </option>
                          <option
                            value="ready"
                            disabled={
                              !["matched", "not-required"].includes(
                                i.fit?.status,
                              ) ||
                              Boolean(
                                i.gift?.isGift &&
                                !i.gift.recipientSize &&
                                i.fit?.kind !== "experience",
                              )
                            }
                          >
                            {L("已备好", "Ready")}
                          </option>
                          <option value="unavailable">
                            {L("缺货替代", "Alternative needed")}
                          </option>
                        </select>
                      </label>
                      {i.status === "unavailable" && (
                        <label className="alternative-select">
                          {L(
                            "建议替代款（由顾客确认）",
                            "Suggested alternative (customer confirms)",
                          )}
                          <select
                            value={i.alternativeId || ""}
                            disabled={b.status === "cancelled"}
                            onChange={(e) =>
                              update((s) => ({
                                ...s,
                                bookings: s.bookings.map((x) =>
                                  x.id === b.id
                                    ? {
                                        ...x,
                                        items: x.items.map((line) =>
                                          line.lineId === i.lineId
                                            ? {
                                                ...line,
                                                alternativeId:
                                                  e.target.value || null,
                                              }
                                            : line,
                                        ),
                                      }
                                    : x,
                                ),
                              }))
                            }
                          >
                            <option value="">
                              {L("暂无替代", "No alternative")}
                            </option>
                            {catalog
                              .filter(
                                (x) =>
                                  x.category === p.category &&
                                  x.id !== p.id &&
                                  state.inventory[x.id] > 0,
                              )
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {L(x.name, x.en)} /{" "}
                                  {money(x.price, state.language)}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                    </div>
                  );
                })}
              </article>
            ))
          ) : (
            <div className="empty-state">
              <Icon name="calendar" size={32} />
              <h3>
                {L(
                  "顾客端的下一次演示预约，会出现在这里。",
                  "The next consumer demo visit will appear here.",
                )}
              </h3>
              <p>
                {L(
                  "在顾客端加入试选清单并预约，即可体验备货同步。",
                  "Add pieces and book in the consumer view to try preparation sync.",
                )}
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <label className="search-field catalog-search">
            <Icon name="search" size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={L("搜索商户目录", "Search merchant catalog")}
              placeholder={L("搜索 SKU / 单品", "Search SKU / piece")}
            />
          </label>
          <div className="catalog-table-wrap">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>{L("单品", "Piece")}</th>
                  <th>{L("分类 / 专柜", "Department / counter")}</th>
                  <th>{L("参考价格", "Demo price")}</th>
                  <th>{L("本地库存", "Local stock")}</th>
                  <th>{L("操作", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {catalog
                  .filter((p) =>
                    `${p.id} ${p.name} ${p.en}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="catalog-product">
                          <Picture src={p.image} alt="" kind={p.kind} />
                          <div>
                            <strong>{L(p.name, p.en)}</strong>
                            <span>
                              {p.id} · {p.brand}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {L(
                          categories.find((c) => c.id === p.category)?.zh,
                          categories.find((c) => c.id === p.category)?.en,
                        )}{" "}
                        · {p.counter}
                      </td>
                      <td>{money(p.price, state.language)}</td>
                      <td>
                        <span
                          className={
                            state.inventory[p.id] === 0 ? "form-error" : ""
                          }
                        >
                          {state.inventory[p.id]}
                        </span>
                      </td>
                      <td>
                        {editing === p.id ? (
                          <div className="inventory-editor">
                            <input
                              type="number"
                              min="0"
                              max="999"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              aria-label={L("新的演示库存", "New demo stock")}
                            />
                            <button
                              className="text-link"
                              onClick={() => {
                                const n = Math.max(
                                  0,
                                  Math.min(
                                    999,
                                    Math.floor(Number(quantity) || 0),
                                  ),
                                );
                                update((s) => ({
                                  ...s,
                                  inventory: { ...s.inventory, [p.id]: n },
                                }));
                                setEditing(null);
                                toastIt(
                                  L(
                                    "演示库存已保存，顾客端立即可见",
                                    "Demo stock saved, now visible in consumer view",
                                  ),
                                );
                              }}
                            >
                              {L("保存", "Save")}
                            </button>
                            <button
                              className="icon-button"
                              onClick={() => setEditing(null)}
                              aria-label={L("取消编辑", "Cancel stock edit")}
                            >
                              <Icon name="close" size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="text-link"
                            onClick={() => {
                              setEditing(p.id);
                              setQuantity(state.inventory[p.id]);
                            }}
                          >
                            {L("编辑库存", "Edit stock")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="microcopy">
            {L(
              "仅改变演示库存；目录结构化数据来自本项目。真实商品管理需商户认证与后端库存系统。",
              "Updates affect demo stock only. The catalog is structured project data. Real catalog management requires merchant authentication and a backend inventory system.",
            )}
          </p>
        </>
      )}
    </section>
  );
}
function GuidePanel({
  open,
  event,
  contextKey,
  view,
  activeModal,
  subtitleHost,
  visitCompanionHost,
  observeKey,
  onEvent,
  onOpen,
  onProduct,
  onBook,
  onEditHistory,
  state,
  filters,
  setFilters,
  L,
  onClose,
  onAdd,
  update,
  toastIt,
  selected,
  onRefine,
  serviceStatus,
}) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: L(
        "可以从眼前这件聊起，也可以告诉我喜欢的颜色、预算或场合。我们一起慢慢挑。",
        "We can start with the piece in front of you, or a colour, budget or occasion you have in mind. Let’s find what feels right for you.",
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [googleConsent, setGoogleConsent] = useState(() => {
    try {
      return sessionStorage.getItem("maison-edit-google-consent") === "true";
    } catch {
      return false;
    }
  });
  const [historyConsent, setHistoryConsent] = useState(false);
  const [companion, setCompanion] = useState(() => {
    try {
      const saved = sessionStorage.getItem("maison-edit-companion");
      return saved === "dismissed" ? "minimized" : saved || "active";
    } catch {
      return "active";
    }
  });
  const companionRef = useRef(companion);
  const [subtitle, setSubtitle] = useState(null);
  const [mode, setMode] = useState("subtitles");
  const sessionRef = useRef(createConciergeSession());
  // Shopping context lives only for this visit. It is independent of popup
  // throttling, so dismissing a bubble does not forget an explicit preference.
  const dialogueSessionRef = useRef({});
  const contextRef = useRef(contextKey);
  const currentEvent = useRef(null);
  const lastGiftAnnouncement = useRef("");
  const lastDeliberateAt = useRef(-Infinity);
  const generation = useRef(0);
  const updateCompanion = (next) => {
    companionRef.current = next;
    setCompanion(next);
    try {
      sessionStorage.setItem("maison-edit-companion", next);
    } catch {}
    if (next !== "active") {
      generation.current++;
      requestRef.current?.abort();
      requestRef.current = null;
      requestProductRef.current = null;
      setWorking(false);
    }
  };
  const endpoint =
    import.meta.env.VITE_GUIDE_ENDPOINT ||
    (serviceStatus.guide === "configured" || serviceStatus.canAttemptGuide
      ? "/api/guide"
      : "");
  const openAI = serviceStatus.provider === "codex-cli";
  const alive = useRef(true);
  const requestRef = useRef(null);
  const requestProductRef = useRef(null);
  const resumeDrawer = useRef(false);
  const drawerScrollTop = useRef(null);
  const closeConversation = () => {
    drawerScrollTop.current = logRef.current?.scrollTop ?? null;
    resumeDrawer.current = true;
    updateCompanion("minimized");
    onClose();
  };
  useEffect(() => {
    // Never apply a delayed reply to a newer piece, page or filter state.
    if (contextRef.current !== contextKey) {
      contextRef.current = contextKey;
      currentEvent.current = null;
      setSubtitle(null);
      generation.current++;
      requestRef.current?.abort();
      setWorking(false);
    }
  }, [contextKey]);
  useEffect(() => {
    if (open) resumeDrawer.current = true;
  }, [open]);
  useLayoutEffect(() => {
    if (!event || event.contextKey !== contextKey) return;
    if (companionRef.current !== "active") return;
    // A scan may be superseded before React delivers its event effect.
    // Never let the previous visible card overwrite the newest local focus.
    if (
      event.type === "attention" &&
      event.attentionToken !== currentEvent.current?.attentionToken
    )
      return;
    const explicitReply = createTryListGuideReply({
      event,
      language: state.language,
    });
    if (explicitReply) {
      currentEvent.current = event;
      const giftKey = JSON.stringify([
        event.productId,
        event.gift?.isGift,
        event.gift?.packagingId,
        event.gift?.recipientSize,
      ]);
      if (event.type === "gift" && lastGiftAnnouncement.current === giftKey)
        return;
      if (event.type === "gift") lastGiftAnnouncement.current = giftKey;
      setSubtitle({ ...explicitReply, event });
      setMessages((lines) => [...lines, explicitReply]);
      return;
    }
    if (
      (["dwell", "attention"].includes(event.type) || event.section) &&
      !conciergeTargets({
        source: {
          productId: event.productId,
          section: event.section,
          occurrenceId: event.occurrenceId,
        },
      }).length
    )
      return;
    if (
      (["dwell", "attention"].includes(event.type) || event.section) &&
      Date.now() - lastDeliberateAt.current <
        (event.type === "attention" ? 1200 : 45000)
    )
      return;
    if (working && ["dwell", "attention"].includes(event.type)) return;
    if (working) {
      generation.current++;
      requestRef.current?.abort();
      setWorking(false);
    }
    currentEvent.current = event;
    if (
      companion !== "active" ||
      open ||
      activeModal === "onboarding" ||
      view === "merchant"
    )
      return;
    const result = acceptConciergeEvent(sessionRef.current, event, Date.now());
    sessionRef.current = result.session;
    const reply = createConciergeReply({
      event,
      language: state.language,
      profile: state.profile,
      filters,
      wishlist: state.wishlist,
      cart: state.cart,
    });
    if (
      event.productId &&
      ["attention", "dwell", "product_open"].includes(event.type)
    ) {
      const contextual = createGuideDialogueReply({
        event,
        productId: event.productId,
        variant: event.variant,
        session: dialogueSessionRef.current,
        language: state.language,
        profile: state.profile,
        filters,
        history: state.purchaseHistory,
        purchaseHistory: state.purchaseHistory,
        wishlist: state.wishlist,
        cart: state.cart,
        feedback: state.feedback,
        inventory: state.inventory,
      });
      Object.assign(reply, contextual);
      if (activeModal === "product") {
        const introduction = dialogueBank[event.productId]?.browsing;
        if (introduction) {
          const phase = contextual.phase || "click";
          reply.visualText = [
            introduction.initial[state.language],
            phase !== "initial" ? introduction[phase]?.[state.language] : "",
          ]
            .filter(Boolean)
            .join(state.language === "en" ? " " : "");
        }
      }
      if (result.accepted && contextual.session)
        dialogueSessionRef.current = contextual.session;
    }
    if (
      !state.cart.length &&
      event.type !== "add" &&
      event.page !== "visit" &&
      event.section !== "visit"
    )
      reply.quickReplies = reply.quickReplies?.filter(
        (action) => action.id !== "booking",
      );
    reply.source = {
      productId: event.productId,
      occurrenceId: event.occurrenceId,
      section: event.section,
      passive:
        ["dwell", "attention"].includes(event.type) || Boolean(event.section),
      attentionToken: event.attentionToken,
      rect:
        event.sourceRect ||
        targetRect(
          conciergeTargets({
            source: {
              productId: event.productId,
              section: event.section,
              occurrenceId: event.occurrenceId,
            },
          })[0],
        ),
    };
    if (event.type === "variant") {
      // A factual variant refresh replaces prior short history copy as well as
      // its full text; otherwise a stale visualText would hide the new choice.
      reply.visualText = undefined;
      reply.ownedProductIds = [];
      reply.relationship = undefined;
      reply.duplicate = false;
    }
    // A chosen variant refreshes the existing line without another announcement.
    if (
      event.type === "variant" &&
      (subtitle?.event?.productId === event.productId ||
        subtitle?.source?.productId === event.productId ||
        subtitle?.productIds?.includes(event.productId))
    ) {
      setSubtitle({ ...reply, event });
      setMessages((m) =>
        m.map((line, index) =>
          index === m.length - 1 && line.proactive
            ? { ...line, ...reply }
            : line,
        ),
      );
    } else if (result.accepted || event.type === "product_open") {
      setSubtitle({ ...reply, event });
      setMessages((m) => [
        ...m,
        {
          ...reply,
          role: "assistant",
          proactive: true,
          attentionHint: event.type === "attention",
        },
      ]);
    }
  }, [event?.sequence]);
  const attention = useCatalogAttention({
    enabled:
      !open &&
      (!activeModal || activeModal === "product") &&
      companion === "active" &&
      view !== "merchant",
    contextKey,
    onChange: (next) => {
      const old = currentEvent.current;
      // A newer browsing target invalidates pending replies even when it is
      // still on screen beside the previous card. Nothing is queued behind it.
      if (
        old?.productId !==
          (next?.element.dataset.conciergeProduct ||
            next?.element.dataset.conciergeCurrentProduct) ||
        old?.occurrenceId !== next?.element.dataset.conciergeOccurrence
      ) {
        if (!working || requestProductRef.current) {
          generation.current++;
          requestRef.current?.abort();
          setWorking(false);
        }
        currentEvent.current = next
          ? {
              type: "attention",
              productId:
                next.element.dataset.conciergeProduct ||
                next.element.dataset.conciergeCurrentProduct,
              section: next.element.dataset.conciergeSection,
              attentionToken: next.token,
              occurrenceId: next.element.dataset.conciergeOccurrence,
            }
          : null;
      }
    },
    onSettle: (next) =>
      onEvent({
        type: "attention",
        productId:
          next.element.dataset.conciergeProduct ||
          next.element.dataset.conciergeCurrentProduct,
        section: next.element.dataset.conciergeSection,
        attentionToken: next.token,
        occurrenceId: next.element.dataset.conciergeOccurrence,
        sourceRect: next.rect,
        attentionKind: next.kind,
      }),
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      requestRef.current?.abort();
    };
  }, []);
  const logRef = useRef();
  useEffect(() => {
    if (open && logRef.current)
      logRef.current.scrollTop =
        drawerScrollTop.current ?? logRef.current.scrollHeight;
  }, [open]);
  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "auto",
    });
  }, [messages, working]);
  const localReply = (text, event = currentEvent.current) => {
    const target =
      byId(event?.productId) || (activeModal === "product" ? selected : null);
    const response = createGuideDialogueReply({
      message: text,
      event,
      productId: target?.id,
      variant: event?.variant,
      session: dialogueSessionRef.current,
      language: state.language,
      profile: state.profile,
      filters,
      history: state.purchaseHistory,
      purchaseHistory: state.purchaseHistory,
      wishlist: state.wishlist,
      cart: state.cart,
      feedback: state.feedback,
      inventory: state.inventory,
    });
    if (response.session) dialogueSessionRef.current = response.session;
    // Only an explicit filter/style request changes the page. Questions about
    // a piece keep the current browsing context and never replace the bag.
    if (response.nextFilters) {
      setFilters(response.nextFilters);
      onRefine();
    }
    if (response.profilePatch)
      update((s) => ({
        ...s,
        profile: { ...s.profile, ...response.profilePatch },
      }));
    return { ...response, role: "assistant", mode: "demo" };
  };
  const send = async (text) => {
    const content = (text || input).trim();
    if (!content || working || companionRef.current !== "active") return;
    lastDeliberateAt.current = Date.now();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: content }]);
    // Sending is the deliberate transition to AI; browsing never calls it.
    if (endpoint) setGoogleConsent(true);
    setWorking(true);
    const requestEvent = currentEvent.current;
    const productScoped =
      (activeModal === "product" && selected) ||
      ["product_open", "variant", "save", "add"].includes(requestEvent?.type) ||
      ["focus", "click", "pointer", "product_view"].includes(
        requestEvent?.attentionKind,
      ) ||
      /这件|这个|颜色|配色|搭配|同款|同系列|购买记录|\bthis (piece|product|item|room)\b|outfit|pair|history|owned|same.series/i.test(
        content,
      );
    const requestSource =
      productScoped && requestEvent?.productId
        ? {
            productId: requestEvent.productId,
            occurrenceId: requestEvent.occurrenceId,
            contextual: true,
          }
        : null;
    requestProductRef.current = requestSource?.productId || null;
    const token = ++generation.current;
    const stillCurrent = () =>
      alive.current &&
      token === generation.current &&
      companionRef.current === "active";
    let response;
    if (endpoint) {
      // Resolve explicit filter intent without changing the page before a reply.
      const currentProduct = byId(
        currentEvent.current?.productId ||
          (activeModal === "product" ? selected?.id : null) ||
          dialogueSessionRef.current.currentProductId,
      );
      const currentVariant = currentEvent.current?.variant;
      const requestContext = {
        ...(!openAI && currentProduct
          ? {
              attention: {
                productId: currentProduct.id,
                kind:
                  {
                    variant: "variant_change",
                    save: "save",
                    add: "bag",
                    product_open: "product_view",
                  }[currentEvent.current?.type] || "viewport",
                ...(currentVariant &&
                currentProduct.colors.includes(currentVariant.color) &&
                currentProduct.sizes.includes(currentVariant.size)
                  ? { color: currentVariant.color, size: currentVariant.size }
                  : {}),
              },
            }
          : {}),
        ...(!openAI && historyConsent
          ? {
              ownedItems: sanitizePurchaseHistory(state.purchaseHistory).slice(
                0,
                8,
              ),
            }
          : {}),
        category: filters.category,
        budget: filters.budget,
        styleTags: [...state.profile.styles],
        selectedProductIds: [
          ...new Set(
            [currentProduct?.id, ...state.cart.map((x) => x.skuId)].filter(
              Boolean,
            ),
          ),
        ].slice(0, 8),
        ...(currentEvent.current?.variant
          ? {
              occasion:
                `Selected variant: ${currentEvent.current.variant.size}, ${currentEvent.current.variant.color}`.slice(
                  0,
                  100,
                ),
            }
          : {}),
      };
      const requestedBudget = content.match(
        /(?:预算|以内|under|budget|¥|￥)\s*(\d{2,5})|\b(\d{3,5})\s*(?:以内|元|cny|rmb)?/i,
      );
      if (requestedBudget)
        requestContext.budget = Math.min(
          10000,
          Math.max(100, Number(requestedBudget[1] || requestedBudget[2])),
        );
      if (/家|客厅|空间|room|home|living/i.test(content))
        requestContext.category = "home";
      else if (/男装|男士|\bmenswear\b|\bmen\b/i.test(content))
        requestContext.category = "men";
      else if (/女装|女士|women/i.test(content))
        requestContext.category = "women";
      else if (/配饰|手袋|accessor|bag/i.test(content))
        requestContext.category = "accessories";
      if (/温暖|暖色|warm/i.test(content))
        requestContext.styleTags.push("warm");
      if (/艺术|artful/i.test(content)) requestContext.styleTags.push("artful");
      if (/极简|quiet|minimal/i.test(content))
        requestContext.styleTags = ["quiet", "tailored"];
      requestContext.styleTags = [...new Set(requestContext.styleTags)];
      if (/清除|重置|reset|clear/i.test(content)) {
        requestContext.category = "all";
        requestContext.budget = 10000;
      }
      // The separate history permission also applies to locally written history
      // references. Do not leak them through assistant turns or preference IDs.
      const ownedIds = new Set(
        sanitizePurchaseHistory(state.purchaseHistory).map(
          (entry) => entry.skuId,
        ),
      );
      const providerSession = historyConsent
        ? dialogueSessionRef.current
        : {
            ...dialogueSessionRef.current,
            likedProductIds: dialogueSessionRef.current.likedProductIds?.filter(
              (id) => !ownedIds.has(id),
            ),
            skippedProductIds:
              dialogueSessionRef.current.skippedProductIds?.filter(
                (id) => !ownedIds.has(id),
              ),
          };
      const preferenceSummary = guideSessionSummary(
        providerSession,
        state.language,
      );
      try {
        const controller = new AbortController();
        requestRef.current = controller;
        const timeout = setTimeout(
          () => controller.abort(),
          openAI ? 150000 : 35000,
        );
        let data;
        try {
          const r = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: content,
              context: requestContext,
              language: state.language,
              history: [
                ...(preferenceSummary
                  ? [{ role: "user", text: preferenceSummary.slice(0, 500) }]
                  : []),
                ...messages
                  .filter(
                    (message) =>
                      message.mode !== "unavailable" &&
                      (!message.proactive ||
                        ["gemini", "codex-cli"].includes(message.mode)) &&
                      (historyConsent || !message.ownedProductIds?.length),
                  )
                  .slice(preferenceSummary ? -7 : -8)
                  .map(({ role, text }) => ({
                    role,
                    text: text.slice(0, 600),
                  })),
              ],
              consent: openAI
                ? { openAI: true }
                : {
                    googleAI: true,
                    ...(historyConsent ? { fictionalHistory: true } : {}),
                  },
              ...(openAI
                ? { presetContext: presetContext(state.profile) }
                : {}),
            }),
            signal: controller.signal,
          });
          if (!r.ok) {
            response = {
              role: "assistant",
              mode: "unavailable",
              warning:
                r.status === 429 ? "rate_limited" : "provider_unavailable",
            };
            throw Error("Guide service unavailable");
          }
          data = await r.json();
          if (!stillCurrent()) return;
        } finally {
          clearTimeout(timeout);
        }
        // Apply explicit shopping preferences locally without replacing live prose.
        localReply(content, requestEvent);
        response = ["gemini", "codex-cli"].includes(data.mode)
          ? {
              role: "assistant",
              text:
                data.reply ||
                L("导购没有返回建议。", "No recommendation returned."),
              productIds: (data.productIds || []).filter(
                (id) =>
                  byId(id) &&
                  byId(id).price <= requestContext.budget &&
                  (requestContext.category === "all" ||
                    byId(id).category === requestContext.category),
              ),
              mode: data.mode,
              model: data.model,
              proseDisclosure: data.proseDisclosure,
            }
          : {
              role: "assistant",
              mode: "unavailable",
              text: guideFailure(data.warning, state.language),
              warning: data.warning || "provider_unavailable",
            };
        if (["gemini", "codex-cli"].includes(data.mode)) {
          toastIt(
            L(
              "真实 AI 建议已就绪，所有价格来自演示目录",
              "Live AI guidance is ready. All prices come from the demo catalog.",
            ),
          );
        }
      } catch {
        if (!stillCurrent()) return;
        const warning = response?.warning || "provider_unavailable";
        response = {
          role: "assistant",
          mode: "unavailable",
          warning,
          text: guideFailure(warning, state.language),
        };
      }
    } else {
      await new Promise((r) => setTimeout(r, 320));
      if (!stillCurrent()) return;
      response = localReply(content, requestEvent);
    }
    if (!stillCurrent()) return;
    if (requestSource) response.source = requestSource;
    if (response.mode === "unavailable") {
      response.source = undefined;
      response.productIds = [];
      response.ownedProductIds = [];
      response.quickReplies = [];
    }
    setMessages((m) => [...m, response]);
    setSubtitle({ ...response, event: requestEvent });
    requestRef.current = null;
    requestProductRef.current = null;
    setWorking(false);
    if (endpoint) serviceStatus.refresh?.();
  };
  const consentControl = endpoint && (
    <p className="guide-send-notice">
      {L(
        "发送消息或点击提问，即由 Gemini 回复，并将对话、当前选款与购物偏好发送给 Google；不附带照片、称呼或身高。浏览介绍使用即时预置内容。",
        "Send a message or tap a question to chat with Gemini. Your conversation, current pieces and shopping preferences go to Google; photos, names and height are excluded. Browsing introductions are instant, prewritten guidance.",
      )}
    </p>
  );
  const quickReply = (id) => {
    if (id === "history") {
      onEditHistory();
      return;
    }
    const target =
      byId(currentEvent.current?.productId) ||
      (activeModal === "product" ? selected : null) ||
      byId(dialogueSessionRef.current.currentProductId) ||
      byId(subtitle?.productIds?.[0]);
    if (id === "booking") {
      if (state.cart.length) onBook();
      else send(L("如何安排到店", "How do I book a visit?"));
    } else if (id === "view") {
      if (target) onProduct(target.id);
      else onBook();
    } else if (id === "add") {
      if (target) onProduct(target.id);
    } else {
      const prompts = {
        color: L("聊聊这款的颜色", "Which colour for this piece?"),
        compare: L("和刚才那款比较一下", "Compare it with the previous piece"),
        alternative: L(
          "有没有更省预算的替代款",
          "Is there a lower-budget alternative?",
        ),
        alternatives: L(
          "有没有更省预算的替代款",
          "Is there a lower-budget alternative?",
        ),
        history: L(
          "和我虚构记录里已有的怎么搭",
          "How does it pair with my fictional owned pieces?",
        ),
        occasion: L("这件适合什么场合", "What occasion would suit this piece?"),
        details: L("再多说一点这件的细节", "Tell me more about this piece"),
        room: L("这个空间怎么搭配", "How would you style this space?"),
        outfit: L("这件怎么搭配", "How would you style this piece?"),
        complement: L(
          "用已有的东西搭配，不要重复购买",
          "Style it with owned pieces without duplicates",
        ),
      };
      send(prompts[id] || prompts.details);
    }
  };
  const stream = useBubbleStream(
    messages,
    open ||
      (Boolean(activeModal) && activeModal !== "product") ||
      companion !== "active",
    contextKey,
    attention?.key || "",
  );
  const companionUI = !open &&
    (activeModal === "product" || !activeModal) &&
    view !== "merchant" &&
    view !== "visit" && (
      <SubtitleConcierge
        L={L}
        message={subtitle}
        transcript={messages}
        attention={attention}
        inline={view === "visit" && !activeModal && Boolean(visitCompanionHost)}
        state={companion}
        providerControls={consentControl}
        liveEnabled={subtitle?.mode === "gemini"}
        productMode={activeModal === "product"}
        working={working}
        input={input}
        stream={stream}
        avoidPageControls={!activeModal}
        mode={mode}
        onMode={setMode}
        onInput={setInput}
        onSend={send}
        onMinimize={() => updateCompanion("minimized")}
        onDismiss={() => updateCompanion("minimized")}
        onResume={() => {
          updateCompanion("active");
          if (resumeDrawer.current) onOpen();
        }}
        onQuick={quickReply}
        onConversation={() => {
          updateCompanion("active");
          onOpen();
        }}
        onProduct={onProduct}
      />
    );
  return (
    <>
      {createPortal(
        companionUI,
        view === "visit" && !activeModal && visitCompanionHost
          ? visitCompanionHost
          : document.body,
      )}
      {open && (
        <Modal
          title={L("你的私人导购。", "Your private guide.")}
          eyebrow="A CONVERSATION, CONSIDERED"
          onClose={closeConversation}
          drawer
        >
          <div className="guide-mode">
            <span className="guide-dot" />
            {endpoint && googleConsent
              ? L("Gemini 导购已开启", "Gemini guidance is enabled")
              : L(
                  "本地情境演示 · 预写对白",
                  "LOCAL CONTEXTUAL DEMO · PREWRITTEN DIALOGUE",
                )}
          </div>
          <div className="guide-conversation-controls">
            <button
              onClick={() => {
                resumeDrawer.current = false;
                updateCompanion("active");
                onClose();
              }}
            >
              {L("回到字幕陪伴", "Continue in subtitles")}
            </button>
            <button
              onClick={() => {
                setMode("voice");
                resumeDrawer.current = false;
                updateCompanion("active");
                onClose();
              }}
            >
              {L("语音模式 · 稍后开放", "Voice mode · coming later")}
            </button>
          </div>
          <div className="guide-preset-context">
            <Picture
              src={getPersonaPreset(state.profile.personaId).image}
              alt=""
              kind="shirt"
            />
            <Picture
              src={roomReference(
                getHomePreset(state.profile.homeId),
                state.profile.room,
              )}
              alt=""
              kind="chair"
            />
            <p>
              <strong>
                {L("当前默认测试场景", "Current fictional test defaults")}
              </strong>
              <span>
                {L(
                  getPersonaPreset(state.profile.personaId).zh,
                  getPersonaPreset(state.profile.personaId).en,
                )}{" "}
                ·{" "}
                {L(
                  getHomePreset(state.profile.homeId).zh,
                  getHomePreset(state.profile.homeId).en,
                )}{" "}
                · {L(...roomNames[state.profile.room])}
              </span>
              <small>
                {L(
                  "预先生成的参照，不是导购生成效果",
                  "Pre-generated references, not guide-generated results",
                )}
              </small>
            </p>
          </div>
          <div className="guide-history-context">
            <span>
              {L(
                `虚构购买记录：${state.purchaseHistory.length} 件，默认仅在本地使用`,
                `Fictional history: ${state.purchaseHistory.length} pieces, local by default`,
              )}
            </span>
            <button className="text-link" onClick={onEditHistory}>
              {L("编辑记录", "Edit history")}
            </button>
          </div>
          {consentControl}
          {endpoint && !openAI && googleConsent && (
            <label className="checkbox-line ai-history-consent">
              <input
                type="checkbox"
                checked={historyConsent}
                onChange={(event) => {
                  setHistoryConsent(event.target.checked);
                  generation.current++;
                  requestRef.current?.abort();
                  setWorking(false);
                }}
              />
              <span>
                {L(
                  "另行允许：将虚构记录前 8 件的商品 ID、颜色与尺码发送至 Google Gemini，用于本次主动提问的搭配建议。不发送收据、购买日期、金额或任何真实账户信息。",
                  "Also allow the first 8 fictional history items’ catalog IDs, colours and sizes to be sent to Google Gemini for deliberate pairing questions. No receipts, purchase dates, paid amounts or real account details are sent.",
                )}
              </span>
            </label>
          )}
          <p className="guide-attention-disclosure">
            {L(
              "浏览时立即展示预置商品介绍；发送消息或点击提问后由 Gemini 回复。缩到侧边后停止新内容。不使用摄像头或眼动追踪。",
              "Browsing shows instant prewritten product introductions. Send a message or tap a question for a Gemini reply. Moving the guide to the side stops new content. No camera or eye tracking.",
            )}
          </p>
          <div
            className="guide-chat"
            role="log"
            aria-label={L("导购对话", "Guide conversation")}
            ref={logRef}
          >
            {messages.map((m, i) => (
              <div
                className={`chat-message ${m.role}`}
                data-attention-hint={m.attentionHint ? "true" : undefined}
                key={i}
              >
                <span className="chat-author">
                  {m.role === "user"
                    ? L("你", "YOU")
                    : m.mode === "codex-cli"
                      ? "OPENAI · GPT CLI TEST"
                      : m.mode === "gemini"
                        ? "GEMINI · LIVE AI"
                        : m.mode === "unavailable"
                          ? L("ÉDIT · 暂不可用", "ÉDIT · UNAVAILABLE")
                          : L("ÉDIT · 演示导购", "ÉDIT · DEMO GUIDE")}
                </span>
                <p>{m.text}</p>
                {m.ownedProductIds?.length > 0 && (
                  <div className="chat-owned-reference">
                    {m.ownedProductIds.map((id) => (
                      <button key={id} onClick={() => onProduct(id)}>
                        {L("虚构记录已有：", "Fictional history: ")}
                        {L(byId(id).name, byId(id).en)} ↗
                      </button>
                    ))}
                  </div>
                )}
                {m.productIds?.length > 0 && (
                  <div className="chat-products">
                    {m.productIds.map((id) => {
                      const p = byId(id);
                      return (
                        <div key={id}>
                          <Picture
                            src={p.image}
                            alt={L(p.name, p.en)}
                            kind={p.kind}
                          />
                          <span>
                            <strong>{L(p.name, p.en)}</strong>
                            <small>{money(p.price, state.language)}</small>
                          </span>
                          <button
                            className="icon-button"
                            aria-label={L(`加入${p.name}`, `Add ${p.en}`)}
                            disabled={!state.inventory[id]}
                            onClick={() =>
                              onAdd(
                                id,
                                p.sizes.includes(state.profile.size)
                                  ? state.profile.size
                                  : p.sizes[0],
                                p.color,
                              )
                            }
                          >
                            <Icon name="plus" size={18} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {m.warning && (
                  <span className="microcopy">
                    {L(
                      "本次没有生成 AI 建议。",
                      "No AI advice was generated for this request.",
                    )}
                  </span>
                )}
              </div>
            ))}
            {working && (
              <div className="guide-loading" role="status">
                {L("正在编选…", "Considering your edit…")}
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
          <div className="guide-shortcuts">
            {messages.at(-1)?.role === "assistant" &&
            messages.at(-1)?.quickReplies?.length
              ? messages.at(-1).quickReplies.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => quickReply(action.id)}
                    disabled={working}
                  >
                    {action.label}
                  </button>
                ))
              : [
                  L("预算 2000 以内", "Budget under 2000"),
                  L("温暖的家居", "Warm home pieces"),
                  L("更省预算的替代款", "A cheaper alternative"),
                  L("清除筛选", "Clear filters"),
                ].map((text) => (
                  <button
                    key={text}
                    onClick={() => send(text)}
                    disabled={working}
                  >
                    {text}
                  </button>
                ))}
          </div>
          <form
            className="guide-input"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="sr-only" htmlFor="guide-message">
              {L("告诉导购你的需求", "Tell your guide what you need")}
            </label>
            <input
              id="guide-message"
              maxLength={1000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={L("我想要……", "I’m looking for…")}
            />
            <button
              className="icon-button"
              type="submit"
              disabled={!input.trim() || working}
              aria-label={L("发送导购消息", "Send guide message")}
            >
              <Icon name="arrow" />
            </button>
          </form>
          <p className="guide-disclaimer">
            {L(
              "没有真实库存或预约接口。人物与空间为预先生成的虚构默认场景，没有实时试衣或空间重绘。",
              "No live stock or booking connection. People and rooms are pre-generated fictional defaults. No live try-on or room restyling.",
            )}
          </p>
        </Modal>
      )}
    </>
  );
}
