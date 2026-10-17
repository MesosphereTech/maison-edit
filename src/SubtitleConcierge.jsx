import { createPortal } from "react-dom";
import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { byId } from "./data.js";
import { sourceIdentity } from "./attention.js";
import { conciergeTargets, visualIsCurrent } from "./concierge-visibility.js";
import { useConciergePlacement } from "./useConciergePlacement.jsx";
import { useAttentionMorph } from "./useAttentionMorph.jsx";
import "./subtitle-history.css";
import "./attention-particles.css";
import "./concierge-collapse.css";
import "./inline-concierge.css";
import {
  BUBBLE_EXIT_MS,
  retireBubbles,
  replaceBubble,
  advanceBubbles,
  revealPhrases,
} from "./bubble-motion.js";

// One live surface stays present as attention changes. The parent also owns
// the complete in-session transcript, including every replaced live line.
export function useBubbleStream(
  messages,
  suspended,
  contextKey,
  attentionKey = "",
) {
  const [bubbles, setBubbles] = useState([]);
  const [held, setHeld] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const queue = useRef([]);
  const previousContext = useRef(contextKey);
  const processed = useRef(1); // The explanatory full-chat greeting is not a popup.
  const state = useRef({ suspended, held });
  const nextAt = useRef(0);
  state.current = { suspended, held };
  useLayoutEffect(() => {
    if (previousContext.current !== contextKey) {
      // Discard obsolete visuals before adding messages produced by this same
      // render (such as a deliberate filter reply). History remains untouched.
      queue.current = [];
      nextAt.current = 0;
      previousContext.current = contextKey;
    }
    queue.current = queue.current.map((b) => ({
      ...b,
      ...messages[Number(b.id.slice(5))],
    }));
    const additions = messages
      .slice(processed.current)
      .map((message, offset) => ({
        ...message,
        id: `line-${processed.current + offset}`,
        remaining: Infinity,
      }));
    processed.current = messages.length;
    const attentionLines = additions.filter(
      (b) =>
        b.source?.passive &&
        (!attentionKey || sourceIdentity(b.source) === attentionKey),
    );
    queue.current.push(...additions.filter((b) => !b.source?.passive));
    if (attentionLines.length) {
      queue.current = queue.current.filter((b) => !b.source?.passive);
      // Attention replies replace one another immediately; never wait behind
      // old products or a conversational presentation queue.
      setBubbles((current) => replaceBubble(current, attentionLines.at(-1)));
    }
    // A variant refresh edits its own existing bubble, rather than stacking it.
    setBubbles((current) =>
      current.map((b) => ({ ...b, ...messages[Number(b.id.slice(5))] })),
    );
  }, [messages, contextKey, attentionKey]);
  useEffect(() => {
    const matches = (b) =>
      !(b.source?.passive || b.source?.contextual) ||
      sourceIdentity(b.source) === attentionKey;
    queue.current = queue.current.filter(matches);
  }, [attentionKey]);
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const { suspended } = state.current;
      queue.current = queue.current.filter(visualIsCurrent);
      const exitMs = matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : BUBBLE_EXIT_MS;
      setBubbles((current) => {
        const valid = current.filter(
          (bubble) => !bubble.source?.passive || visualIsCurrent(bubble),
        );
        return advanceBubbles(
          valid.length === current.length ? current : valid,
          {
            now,
            exitMs,
          },
        );
      });
      if (suspended) return;
      if (queue.current.length && now >= nextAt.current) {
        const next = queue.current.shift();
        setBubbles((current) => replaceBubble(current, next, now));
        nextAt.current = now + 650;
      }
    }, 80);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let timer,
      active = false;
    const onScroll = (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".subtitle-concierge")
      )
        return;
      if (!active) {
        active = true;
        setScrolling(true);
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        active = false;
        setScrolling(false);
      }, 120);
    };
    window.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);
  const clear = useCallback(() => {
    queue.current = [];
    setBubbles((current) => retireBubbles(current, () => true, "clear"));
  }, []);
  return {
    clear,
    bubbles,
    scrolling,
    setHeld,
    dismiss: (id) =>
      setBubbles((current) =>
        retireBubbles(current, (b) => b.id === id, "dismiss"),
      ),
  };
}

function ProgressiveBubbleText({
  text = "",
  product,
  L,
  attentionToken,
  immediate = false,
}) {
  const copyRef = useRef(null);
  const previousAttention = useRef(attentionToken);
  useLayoutEffect(() => {
    if (previousAttention.current !== attentionToken) {
      // Settle the old copy immediately when attention changes. A newer reply
      // gets a fresh keyed reveal; stale phrases cannot keep fading behind it.
      copyRef.current?.getAnimations({ subtree: true }).forEach((animation) => {
        try {
          animation.finish();
        } catch {
          animation.cancel();
        }
      });
    }
    previousAttention.current = attentionToken;
  }, [attentionToken]);
  const phrases = revealPhrases(text);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span
        ref={copyRef}
        className="bubble-progressive-copy"
        data-copy-mode={immediate ? "immediate" : "progressive"}
        aria-hidden="true"
        key={text}
      >
        {product && (
          <span className="bubble-current-subject">
            {L(product.name, product.en)}
          </span>
        )}
        {phrases.map((phrase, index) => (
          <span
            className="bubble-reveal-phrase"
            key={index}
            style={{
              "--phrase-delay": `${index * Math.min(130, 1300 / Math.max(1, phrases.length - 1))}ms`,
            }}
          >
            {phrase}
          </span>
        ))}
      </span>
    </>
  );
}

export function SubtitleConcierge({
  L,
  message,
  transcript = [],
  attention,
  state,
  paused,
  working,
  input,
  mode,
  onMode,
  onInput,
  onSend,
  onPause,
  onMinimize,
  onDismiss,
  onResume,
  onQuick,
  onConversation,
  onProduct,
  stream,
  avoidPageControls = false,
  inline = false,
}) {
  const asideRef = useRef(null);
  const inputRef = useRef(null);
  const composerRef = useRef(null);
  const [linkedBubble, setLinkedBubble] = useState(null);
  // Legacy dismissed sessions now have a durable, explicit return control.
  const effectiveState = state === "dismissed" ? "minimized" : state;
  const [displayState, setDisplayState] = useState(effectiveState);
  const resumeRef = useRef(null);
  const previousPresentation = useRef(effectiveState);
  useLayoutEffect(() => {
    if (
      effectiveState === "active" ||
      displayState !== "active" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplayState(effectiveState);
      return;
    }
    const aside = asideRef.current;
    const rect = aside?.getBoundingClientRect();
    if (rect) {
      aside.style.setProperty(
        "--collapse-x",
        `${innerWidth - 72 - rect.left}px`,
      );
      aside.style.setProperty(
        "--collapse-y",
        `${innerHeight / 2 - 32 - rect.top}px`,
      );
    }
    const timer = setTimeout(
      () => setDisplayState(effectiveState),
      BUBBLE_EXIT_MS,
    );
    return () => clearTimeout(timer);
  }, [effectiveState, displayState]);
  const presentationState =
    effectiveState === "active"
      ? "active"
      : matchMedia("(prefers-reduced-motion: reduce)").matches
        ? effectiveState
        : displayState;
  const leaving = presentationState === "active" && effectiveState !== "active";
  useLayoutEffect(() => {
    const previous = previousPresentation.current;
    previousPresentation.current = presentationState;
    if (presentationState === "minimized")
      resumeRef.current?.focus({ preventScroll: true });
    else if (previous === "minimized" && presentationState === "active")
      (
        asideRef.current?.querySelector(".bubble-history-trigger") ||
        inputRef.current
      )?.focus({ preventScroll: true });
  }, [presentationState]);
  const bubbleRef = useRef(null);
  const historyId = useId();
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const historyPosition = useRef(null);
  const rememberHistoryPosition = useCallback(() => {
    const viewport = bubbleRef.current;
    if (!viewport) return;
    const top = viewport.getBoundingClientRect().top;
    const anchor = [...viewport.querySelectorAll("[data-bubble-id]")].find(
      (bubble) => bubble.getBoundingClientRect().bottom > top + 1,
    );
    historyPosition.current = {
      scrollTop: viewport.scrollTop,
      anchorId: anchor?.dataset.bubbleId,
      offset: anchor ? anchor.getBoundingClientRect().top - top : 0,
    };
  }, []);
  const toggleHistory = useCallback(() => {
    if (historyExpanded) rememberHistoryPosition();
    setHistoryExpanded((expanded) => !expanded);
  }, [historyExpanded, rememberHistoryPosition]);
  useEffect(() => {
    if (!historyExpanded) return;
    const inspect = (event) => {
      if (
        event.type !== "maison:product-inspect" &&
        (!(event.target instanceof Element) ||
          !event.target.closest(
            ".product-image-button,.product-name,.scene-swap-button,[data-outfit-product],.bubble-piece,.bubble-owned-reference button",
          ))
      )
        return;
      rememberHistoryPosition();
      setHistoryExpanded(false);
    };
    document.addEventListener("click", inspect, true);
    window.addEventListener("maison:product-inspect", inspect);
    return () => {
      document.removeEventListener("click", inspect, true);
      window.removeEventListener("maison:product-inspect", inspect);
    };
  }, [historyExpanded, rememberHistoryPosition]);
  const [focusWithin, setFocusWithin] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (effectiveState !== "active") {
      setLinkedBubble(null);
      setFocusWithin(false);
      setHovered(false);
    }
  }, [effectiveState]);
  useEffect(
    () =>
      stream.setHeld(
        effectiveState === "active" &&
          (historyExpanded || focusWithin || hovered || Boolean(input.trim())),
      ),
    [
      effectiveState,
      historyExpanded,
      focusWithin,
      hovered,
      input,
      stream.setHeld,
    ],
  );
  const latestAssistant = [...stream.bubbles]
    .reverse()
    .find((b) => b.role !== "user" && !b.retiring);
  const morphRef = useRef(null);
  const yielding = useConciergePlacement({
    active: state === "active" && presentationState === "active" && !inline,
    asideRef,
    composerRef,
    inputRef,
    avoidPageControls,
    held: historyExpanded || focusWithin || hovered,
    revision: `${historyExpanded ? "history" : "current"}:${input ? "typing" : "idle"}:${stream.bubbles.map((b) => `${b.id}:${b.text}`).join("|")}`,
  });
  // Settle the available rail height before restoring the reading anchor.
  // Expanded history is a reading surface. Restore its visible anchor rather
  // than following incoming turns or variant text updates to the newest line.
  useLayoutEffect(() => {
    const viewport = bubbleRef.current;
    if (!viewport) return;
    if (!historyExpanded) {
      // There is one persistent live bubble. Start at its words, rather than
      // scrolling its opening phrases out of the short mobile reading rail.
      viewport.scrollTop = 0;
      return;
    }
    const position = historyPosition.current;
    if (!position) viewport.scrollTop = viewport.scrollHeight;
    else {
      viewport.scrollTop = position.scrollTop;
      const anchor = [...viewport.querySelectorAll("[data-bubble-id]")].find(
        (bubble) => bubble.dataset.bubbleId === position.anchorId,
      );
      if (anchor)
        viewport.scrollTop +=
          anchor.getBoundingClientRect().top -
          viewport.getBoundingClientRect().top -
          position.offset;
    }
    rememberHistoryPosition();
  }, [
    state,
    historyExpanded,
    transcript,
    stream.bubbles.at(-1)?.id,
    stream.bubbles.at(-1)?.text,
    rememberHistoryPosition,
  ]);
  useAttentionMorph({
    frameRef: morphRef,
    asideRef,
    attention,
    latestAssistant,
    active:
      state === "active" &&
      presentationState === "active" &&
      !historyExpanded &&
      !inline,
  });
  // Source emphasis is deliberate while reading or focusing its live reply.
  useEffect(() => {
    if (!latestAssistant) return;
    const targets = conciergeTargets(latestAssistant);
    const focusSource = (event) => {
      if (targets.some((el) => el.contains(event.target)))
        setLinkedBubble(latestAssistant.id);
      else if (!asideRef.current?.contains(event.target)) setLinkedBubble(null);
    };
    document.addEventListener("focusin", focusSource);
    return () => document.removeEventListener("focusin", focusSource);
  }, [latestAssistant?.id]);
  useEffect(() => {
    if (!latestAssistant || linkedBubble !== latestAssistant.id) return;
    const targets = conciergeTargets(latestAssistant);
    targets.forEach((el) => el.classList.add("concierge-source-reading"));
    return () =>
      targets.forEach((el) => el.classList.remove("concierge-source-reading"));
  }, [latestAssistant?.id, linkedBubble]);
  if (presentationState === "minimized")
    return (
      <aside
        key="concierge-launcher"
        className={`subtitle-concierge is-minimized ${inline ? "is-inline" : ""}`}
        aria-label={L("字幕导购已最小化", "Subtitle concierge minimized")}
      >
        <button
          ref={resumeRef}
          className="subtitle-resume"
          onClick={onResume}
          aria-label={L("展开 ÉDIT 对话", "Expand ÉDIT conversation")}
          title={L(
            "展开对话，继续刚才的聊天",
            "Open your conversation where you left off",
          )}
        >
          <span className="subtitle-resume-mark" aria-hidden="true">
            ✧
          </span>
          <strong>ÉDIT</strong>
          <span>
            {L("展开", "Open")} <span aria-hidden="true">‹</span>
          </span>
        </button>
      </aside>
    );
  const visible = historyExpanded
    ? transcript.map((line, index) => ({
        ...line,
        id: `line-${index}`,
        remaining: Infinity,
      }))
    : stream.bubbles.filter(
        (bubble) =>
          bubble.retiring ||
          bubble.id === stream.bubbles.filter((b) => !b.retiring).at(-1)?.id,
      );
  const currentBubbleId = visible
    .filter((bubble) => !bubble.retiring)
    .at(-1)?.id;
  return (
    <>
      {attention?.rect &&
        !historyExpanded &&
        createPortal(
          <div
            ref={morphRef}
            className="concierge-attention-frame"
            aria-hidden="true"
            data-attention-product={
              attention.element.dataset.conciergeProduct ||
              attention.element.dataset.conciergeCurrentProduct ||
              attention.key
            }
            data-attention-occurrence={
              attention.element.dataset.conciergeOccurrence
            }
          >
            <svg width="100%" height="100%" aria-hidden="true">
              <rect
                className="attention-shell-fill"
                width="100%"
                height="100%"
                rx="10"
                fill="#f8f4eced"
              />
              <rect
                className="attention-shell-outline"
                pathLength="100"
                width="100%"
                height="100%"
                rx="10"
                fill="none"
                stroke="#9e733ae8"
                strokeWidth="1.8"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>,
          document.body,
        )}
      <aside
        key="concierge-open"
        ref={asideRef}
        inert={leaving || undefined}
        aria-hidden={leaving || undefined}
        className={`subtitle-concierge ${inline ? "is-inline" : ""} ${leaving ? "is-leaving" : ""} ${historyExpanded ? "is-history-expanded" : ""} ${stream.scrolling && !historyExpanded && !focusWithin && !hovered ? "is-scrolling" : ""} ${yielding ? "is-yielding" : ""}`}
        aria-label={L("字幕导购", "Subtitle concierge")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocusWithin(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocusWithin(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (historyExpanded) rememberHistoryPosition();
            onMinimize();
          }
        }}
      >
        <div className="subtitle-heading">
          <span>
            ÉDIT <i>/</i> {L("字幕陪伴", "SUBTITLES")}
          </span>
          <div className="subtitle-controls">
            <button
              onClick={onPause}
              aria-pressed={paused}
              aria-label={L(
                paused ? "恢复主动字幕" : "暂停主动字幕",
                paused
                  ? "Resume proactive subtitles"
                  : "Pause proactive subtitles",
              )}
              title={L(
                paused ? "恢复主动字幕" : "暂停主动字幕",
                paused
                  ? "Resume proactive subtitles"
                  : "Pause proactive subtitles",
              )}
            >
              {paused ? "▷" : "Ⅱ"}
            </button>
            <button
              onClick={onMinimize}
              aria-label={L("最小化字幕", "Minimize subtitles")}
              title={L("最小化字幕", "Minimize subtitles")}
            >
              −
            </button>
            <button
              onClick={onMinimize}
              aria-label={L("关闭字幕陪伴", "Dismiss subtitle concierge")}
              title={L("关闭字幕陪伴", "Dismiss subtitle concierge")}
            >
              ×
            </button>
          </div>
        </div>
        {historyExpanded && (
          <div className="subtitle-history-heading">
            <span>
              {L("对话历史", "Conversation history")} · {transcript.length}
            </span>
            <button
              type="button"
              onClick={() => {
                rememberHistoryPosition();
                onMinimize();
              }}
              aria-label={L("收起对话历史", "Collapse conversation history")}
            >
              {L("收起", "Collapse")} ↓
            </button>
          </div>
        )}
        <div
          id={historyId}
          className={`subtitle-bubbles ${historyExpanded ? "subtitle-history" : ""}`}
          ref={bubbleRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label={
            historyExpanded
              ? L("对话历史", "Conversation history")
              : L("实时对话气泡", "Live conversation bubbles")
          }
          onScroll={() => historyExpanded && rememberHistoryPosition()}
        >
          {visible.map((bubble) => (
            <div
              className={`subtitle-bubble ${bubble.source?.passive ? "attention-bubble" : ""} ${bubble.retiring ? "is-retiring" : ""} ${bubble.role} ${linkedBubble === bubble.id ? "is-linked" : ""}`}
              key={
                !historyExpanded || bubble.id === currentBubbleId
                  ? "concierge-live"
                  : bubble.id
              }
              data-persistent-surface={!historyExpanded || undefined}
              data-bubble-id={bubble.id}
              data-source-product={bubble.source?.productId}
              data-source-occurrence={bubble.source?.occurrenceId}
              data-exit-reason={bubble.exitReason}
              aria-hidden={bubble.retiring || undefined}
              inert={bubble.retiring || undefined}
              onClick={(event) => {
                if (
                  bubble.id !== currentBubbleId ||
                  event.target.closest(
                    "button, a, input, select, textarea, [role=button]",
                  )
                )
                  return;
                toggleHistory();
              }}
              aria-controls={
                conciergeTargets(bubble)
                  .map((el) => el.id)
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              onMouseEnter={() =>
                bubble.role !== "user" && setLinkedBubble(bubble.id)
              }
              onMouseLeave={() => setLinkedBubble(null)}
              onFocusCapture={() =>
                bubble.role !== "user" && setLinkedBubble(bubble.id)
              }
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  setLinkedBubble(null);
              }}
            >
              <div className="bubble-content">
                {!historyExpanded && (
                  <button
                    className="bubble-dismiss"
                    onClick={onMinimize}
                    aria-label={L(
                      bubble.role === "user"
                        ? "收起这条用户气泡"
                        : "收起这条导购气泡",
                      bubble.role === "user"
                        ? "Dismiss user bubble"
                        : "Dismiss guide bubble",
                    )}
                  >
                    ×
                  </button>
                )}
                {bubble.id === currentBubbleId ||
                (!historyExpanded && bubble.retiring) ? (
                  <button
                    className="bubble-history-trigger"
                    type="button"
                    aria-describedby={`${historyId}-${bubble.id}-text`}
                    onClick={toggleHistory}
                    aria-expanded={historyExpanded}
                    aria-controls={historyId}
                    aria-label={L(
                      historyExpanded ? "收起对话历史" : "展开对话历史",
                      historyExpanded
                        ? "Collapse conversation history"
                        : "Show conversation history",
                    )}
                  >
                    <span className="bubble-author">
                      {bubble.role === "user"
                        ? L("你", "YOU")
                        : bubble.mode === "codex-cli"
                          ? "ÉDIT · GPT CLI TEST"
                          : bubble.mode === "gemini"
                            ? "ÉDIT · GEMINI"
                            : L("ÉDIT · 本地演示", "ÉDIT · LOCAL DEMO")}
                      <span className="bubble-history-cue" aria-hidden="true">
                        {historyExpanded ? "↓" : "↑"}
                      </span>
                    </span>
                    <span
                      className="bubble-text"
                      id={`${historyId}-${bubble.id}-text`}
                    >
                      {historyExpanded ? (
                        bubble.text
                      ) : (
                        <ProgressiveBubbleText
                          key={`${bubble.id}:${bubble.visualText || bubble.text}`}
                          text={bubble.visualText || bubble.text}
                          product={byId(
                            bubble.source?.productId || bubble.productIds?.[0],
                          )}
                          L={L}
                          attentionToken={attention?.token}
                          immediate={Boolean(bubble.source?.passive)}
                        />
                      )}
                    </span>
                  </button>
                ) : (
                  <>
                    <span className="bubble-author">
                      {bubble.role === "user"
                        ? L("你", "YOU")
                        : bubble.mode === "codex-cli"
                          ? "ÉDIT · GPT CLI TEST"
                          : bubble.mode === "gemini"
                            ? "ÉDIT · GEMINI"
                            : L("ÉDIT · 本地演示", "ÉDIT · LOCAL DEMO")}
                    </span>
                    <p>{bubble.text}</p>
                  </>
                )}
                {bubble.ownedProductIds?.length > 0 && (
                  <div className="bubble-owned-reference">
                    {bubble.ownedProductIds.slice(0, 1).map((id) => (
                      <button key={id} onClick={() => onProduct(id)}>
                        {L("虚构记录已有：", "Fictional history: ")}
                        {L(byId(id).name, byId(id).en)} <span>↗</span>
                      </button>
                    ))}
                  </div>
                )}
                {bubble.role !== "user" &&
                  (bubble.id === currentBubbleId ||
                    (!historyExpanded && bubble.retiring)) && (
                    <>
                      {bubble.productIds?.length > 0 &&
                        bubble.productIds.slice(0, 2).map((id) => {
                          const product = byId(id);
                          return (
                            product && (
                              <button
                                className="bubble-piece"
                                key={id}
                                onClick={() => onProduct(id)}
                              >
                                {L(product.name, product.en)} <span>↗</span>
                              </button>
                            )
                          );
                        })}
                      <div className="bubble-replies">
                        {(
                          bubble.quickReplies ||
                          message?.quickReplies || [
                            {
                              id: "booking",
                              label: L("安排到店", "Plan a visit"),
                            },
                          ]
                        )
                          .slice(0, 3)
                          .map((reply) => (
                            <button
                              key={reply.id}
                              onClick={() => onQuick(reply.id)}
                              disabled={working}
                            >
                              {reply.label}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
              </div>
            </div>
          ))}
        </div>
        {mode === "voice" && (
          <div className="subtitle-voice-note" role="status">
            <p>
              {L(
                "语音模式稍后开放。此版本没有语音连接，也不会启动麦克风。对话与当前选款会保留。",
                "Voice is planned for later. No voice connection or microphone is active. Your conversation and current piece stay together.",
              )}
            </p>
            <button onClick={() => onMode("subtitles")}>
              {L("继续使用字幕", "Continue with subtitles")}
            </button>
          </div>
        )}
        <form
          className="subtitle-composer"
          ref={composerRef}
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
          }}
        >
          <label className="sr-only" htmlFor="subtitle-message">
            {L("回复你的导购", "Reply to your guide")}
          </label>
          <input
            id="subtitle-message"
            ref={inputRef}
            maxLength={1000}
            value={input}
            onChange={(event) => onInput(event.target.value)}
            placeholder={L("和 ÉDIT 聊聊…", "A thought for ÉDIT…")}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim() || working}
            aria-label={L("发送字幕回复", "Send subtitle reply")}
          >
            {working ? "· · ·" : "↗"}
          </button>
        </form>
        <div className="subtitle-footnote">
          <span>
            {paused
              ? L("主动字幕已暂停", "PROACTIVE SUBTITLES PAUSED")
              : L(
                  "本地演示 · 随你浏览，持续陪伴",
                  "LOCAL DEMO · HERE AS YOU BROWSE",
                )}
          </span>
          <button onClick={onConversation}>{L("对话", "Conversation")}</button>
          <button
            onClick={() => onMode(mode === "voice" ? "subtitles" : "voice")}
            aria-pressed={mode === "voice"}
          >
            {L("语音 · 稍后", "Voice · later")}
          </button>
        </div>
      </aside>
    </>
  );
}
