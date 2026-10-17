import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  initialVisitPreferences,
  interpretVisitMessage,
  buildAIVisitPlan,
  visitPlanReply,
} from "./visit-ai-plan.js";
import { tryListSizeLabel } from "./try-list.js";
import { giftPackagingOptions } from "./gift-packaging.js";
import { personalizedSceneFor } from "./personalized-scenes.js";
import { getPersonaPreset } from "./presets.js";
import "./visit-ai-workspace.css";

const Arrow = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path d="M4 12h16m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
const stages = ["route", "outfit", "gift"];
const localChatKey = "maison-edit-visit-chat";
const planningSessionPrefix = "maison-edit-visit-plan:";
function readPlanningSession(key) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (saved?.version !== 1) return null;
    const value = saved.preferences || {},
      defaults = initialVisitPreferences();
    const preferences = {
      ...defaults,
      duration:
        Number.isInteger(value.duration) &&
        value.duration >= 15 &&
        value.duration <= 180
          ? value.duration
          : null,
      shoesFirst: value.shoesFirst === true,
      lessWalking: value.lessWalking === true,
      giftFocus: value.giftFocus === true,
      stage: stages.includes(value.stage) ? value.stage : defaults.stage,
      packagingId: giftPackagingOptions.some(
        (option) => option.id === value.packagingId,
      )
        ? value.packagingId
        : null,
      size: /^(XS|S|M|L|XL)$/.test(value.size || "") ? value.size : null,
      revision:
        Number.isInteger(value.revision) &&
        value.revision > 0 &&
        value.revision < 10000
          ? value.revision
          : 1,
    };
    const messages = Array.isArray(saved.messages)
      ? saved.messages
          .filter(
            (message) =>
              ["user", "assistant"].includes(message?.role) &&
              typeof message.text === "string",
          )
          .slice(-40)
          .map((message) => ({
            role: message.role,
            text: message.text.slice(0, 6000),
            mode: ["gemini", "codex-cli"].includes(message.mode)
              ? message.mode
              : "local",
            ...(Number.isInteger(message.revision) &&
            message.revision > 0 &&
            message.revision < 10000
              ? { revision: message.revision }
              : {}),
          }))
      : [];
    return { preferences, messages };
  } catch {
    return null;
  }
}
export function clearVisitPlanningSessions() {
  try {
    Object.keys(sessionStorage)
      .filter(
        (key) => key === localChatKey || key.startsWith(planningSessionPrefix),
      )
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {}
}

function RouteMap({ plan, currentStop, onStop, L }) {
  const locations = plan.stops.map((stop, index) => {
    const sameFloor = plan.stops.filter(
      (candidate) => candidate.floor === stop.floor,
    );
    const floorIndex = sameFloor.findIndex(
      (candidate) => candidate.id === stop.id,
    );
    return {
      x: 320 + (floorIndex - (sameFloor.length - 1) / 2) * 88,
      y: 122 + (4 - stop.floor) * 74,
      stop,
      index,
    };
  });
  const path = locations
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const floorLabels = [
    L("礼宾与配饰", "Concierge & accessories"),
    L("女士衣橱", "Womenswear"),
    L("男士衣橱", "Menswear"),
    L("家与生活", "Home & living"),
  ];
  return (
    <div className="va-map-wrap" data-plan-map-revision={plan.revision}>
      <svg
        className="va-route-map"
        viewBox="0 0 640 420"
        role="img"
        aria-label={L(
          `${plan.minutes}分钟，${plan.stops.length}站的演示路线`,
          `${plan.minutes}-minute demonstration route with ${plan.stops.length} stops`,
        )}
      >
        <defs>
          <linearGradient id="va-floor" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#fbf8ef" />
            <stop offset="1" stopColor="#ded5c4" />
          </linearGradient>
        </defs>
        {[4, 3, 2, 1].map((floor) => (
          <g key={floor}>
            <path
              d={`M138 ${87 + (4 - floor) * 74}h355l48 25-48 51H138l-48-25Z`}
              fill="url(#va-floor)"
              stroke="#c9baa3"
            />
            <path d={`M138 ${98 + (4 - floor) * 74}h355`} stroke="#e1d7c8" />
            <text x="35" y={115 + (4 - floor) * 74} className="va-map-floor">
              0{floor}
            </text>
            <text x="35" y={132 + (4 - floor) * 74} className="va-map-small">
              FLOOR
            </text>
            <text
              x="456"
              y={145 + (4 - floor) * 74}
              className="va-map-floor-label"
              textAnchor="end"
            >
              {floorLabels[floor - 1]}
            </text>
          </g>
        ))}
        <path
          d={path}
          className="va-map-path"
          fill="none"
          stroke={plan.preferences.lessWalking ? "#49604e" : "#682f3e"}
          strokeWidth="2"
          strokeDasharray={plan.preferences.lessWalking ? "3 4" : "6 5"}
          strokeLinejoin="round"
        />
        {locations.map(({ x, y, stop, index }) => (
          <g
            key={stop.id}
            className={currentStop.id === stop.id ? "is-active" : ""}
            data-map-stop={stop.id}
          >
            <circle
              cx={x}
              cy={y}
              r={currentStop.id === stop.id ? 21 : 17}
              fill={currentStop.id === stop.id ? "#542c38" : "#fbf8ef"}
              stroke="#682f3e"
              strokeWidth="1.4"
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              className="va-map-number"
              fill={currentStop.id === stop.id ? "#fffaf0" : "#542c38"}
            >
              {String(index + 1).padStart(2, "0")}
            </text>
          </g>
        ))}
        <path
          d="M548 89v266m-5-257 5-9 5 9m-10 248 5 9 5-9"
          stroke="#9b896d"
          fill="none"
        />
        <text
          x="575"
          y="226"
          transform="rotate(90 575 226)"
          className="va-map-lift"
        >
          {L("电梯串联各层", "LIFT BETWEEN FLOORS")}
        </text>
        <text x="120" y="404" className="va-map-small">
          {L(
            "虚构楼层示意 · 非真实导航",
            "FICTIONAL FLOOR PLAN · ILLUSTRATIVE ROUTE",
          )}
        </text>
      </svg>
      <div className="va-map-legend">
        <span>
          <i />
          {L("当前路线", "Your route")}
        </span>
        <span>
          {plan.preferences.lessWalking
            ? L("电梯优先 · 减少停留", "Lifts first · fewer stops")
            : L(
                "按楼层安排 · 可随时调整",
                "Floor by floor · always adjustable",
              )}
        </span>
      </div>
    </div>
  );
}

export default function VisitJourneyShowcase({
  state,
  L,
  onBook,
  onBag,
  onExplore,
  onProduct,
  serviceStatus = {},
}) {
  const sessionKey = `${planningSessionPrefix}${state.profile.personaId}`;
  const [savedSession] = useState(() => readPlanningSession(sessionKey));
  const [preferences, setPreferences] = useState(
    () => savedSession?.preferences || initialVisitPreferences(),
  );
  const plan = useMemo(
    () => buildAIVisitPlan(state, preferences),
    [state, preferences],
  );
  const [entryPlan] = useState(() => buildAIVisitPlan(state));
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => savedSession?.messages || []);
  const [stopId, setStopId] = useState("");
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return sessionStorage.getItem(localChatKey) === "minimized";
    } catch {
      return false;
    }
  });
  const [liveConsent, setLiveConsent] = useState(false);
  const [working, setWorking] = useState(false);
  const logRef = useRef(null),
    requestRef = useRef(null),
    generation = useRef(0);
  const stageStop =
    preferences.stage === "gift"
      ? plan.stops.find((stop) => stop.id === "gift")
      : preferences.stage === "outfit"
        ? plan.stops.find((stop) => stop.id.startsWith("wardrobe"))
        : null;
  const currentStop =
    plan.stops.find((stop) => stop.id === stopId) ||
    stageStop ||
    plan.stops.find((stop) => stop.items.length) ||
    plan.stops[0];
  const initialMessage = visitPlanReply(entryPlan, state.language, true, true);
  const firstVisitStop =
    plan.stops.find((stop) => stop.items.length) || plan.stops[0];
  const packing =
    giftPackagingOptions.find(
      (option) =>
        option.id ===
        (preferences.packagingId || plan.giftLines[0]?.gift?.packagingId),
    ) || giftPackagingOptions[0];
  const wear = plan.lines.find(
    (line) =>
      !line.gift?.isGift &&
      ["women", "men"].includes(line.product.category) &&
      line.product.kind !== "shoe",
  );
  const scene =
    wear && personalizedSceneFor(wear.skuId, plan.profile, wear.color);
  const fittingReference = Boolean(wear && scene);
  const scenePersona = scene?.personaId
    ? getPersonaPreset(scene.personaId)
    : plan.persona;
  const scenePersonaLabel =
    scene?.personaId && scene.personaId !== plan.profile.personaId
      ? L(
          `礼物展示人物 · ${scenePersona.zh}`,
          `Gift-model reference · ${scenePersona.en}`,
        )
      : L(scenePersona.zh, scenePersona.en);
  const stageImage = fittingReference
    ? scene.src
    : (wear || plan.lines.find((line) => !line.gift?.isGift) || plan.lines[0])
        ?.product.image;
  const hasEndpoint = Boolean(
    import.meta.env.VITE_GUIDE_ENDPOINT ||
    serviceStatus.guide === "configured" ||
    serviceStatus.canAttemptGuide,
  );
  const openAI = serviceStatus.provider === "codex-cli";
  useEffect(() => {
    try {
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          version: 1,
          preferences,
          messages: messages.slice(-40),
        }),
      );
    } catch {}
  }, [sessionKey, preferences, messages]);
  useEffect(
    () => () => {
      generation.current++;
      requestRef.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, working, collapsed]);
  const toggleChat = () =>
    setCollapsed((value) => {
      const next = !value;
      try {
        sessionStorage.setItem(localChatKey, next ? "minimized" : "active");
      } catch {}
      return next;
    });
  const selectStop = (stop) => {
    setStopId(stop.id);
    setPreferences((p) => ({
      ...p,
      stage: stop.id === "gift" ? "gift" : "route",
    }));
  };
  const send = async (value = input) => {
    const text = value.trim();
    if (!text || working) return;
    const result = interpretVisitMessage(text, preferences),
      nextPlan = buildAIVisitPlan(state, result.preferences);
    setPreferences(result.preferences);
    setInput("");
    if (result.preferences.stage === "gift") setStopId("gift");
    else if (result.preferences.stage === "outfit")
      setStopId(
        nextPlan.stops.find((stop) => stop.id.startsWith("wardrobe"))?.id || "",
      );
    else if (result.preferences.shoesFirst)
      setStopId(
        nextPlan.stops.find((stop) => stop.id.startsWith("shoes"))?.id || "",
      );
    const response = {
      role: "assistant",
      text: visitPlanReply(nextPlan, state.language, result.understood),
      revision: nextPlan.revision,
      mode: "local",
    };
    setMessages((previous) => [...previous, { role: "user", text }, response]);
    if (!hasEndpoint || !liveConsent) return;
    const token = ++generation.current;
    setWorking(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(
      () => controller.abort(),
      openAI ? 150000 : 20000,
    );
    try {
      const r = await fetch(
        import.meta.env.VITE_GUIDE_ENDPOINT || "/api/guide",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: text,
            language: state.language,
            context: {
              category: "all",
              budget: 10000,
              styleTags: [],
              selectedProductIds: [
                ...new Set(nextPlan.lines.map((line) => line.skuId)),
              ].slice(0, 8),
              occasion:
                `Local visit plan: ${nextPlan.minutes} minutes. ${nextPlan.stops.map((stop) => `${stop.floor}F ${stop.en}`).join("; ")}`.slice(
                  0,
                  100,
                ),
            },
            history: [],
            consent: openAI ? { openAI: true } : { googleAI: true },
          }),
        },
      );
      if (!r.ok) throw Error("unavailable");
      const data = await r.json();
      if (generation.current !== token) return;
      if (["gemini", "codex-cli"].includes(data.mode) && data.reply)
        setMessages((previous) => [
          ...previous,
          { role: "assistant", text: data.reply, mode: data.mode },
        ]);
      else
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            text: L(
              "实时连接尚未就绪，以上仍为本地情境方案。",
              "The live connection is not ready. The plan above remains the local scenario.",
            ),
            mode: "local",
          },
        ]);
    } catch {
      if (generation.current === token)
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            text: L(
              "连接暂不可用，已保留上方本地方案。",
              "The connection is unavailable. Your local plan above is preserved.",
            ),
            mode: "local",
          },
        ]);
    } finally {
      clearTimeout(timeout);
      if (generation.current === token) setWorking(false);
    }
  };
  const setStage = (stage) => {
    setPreferences((previous) => ({ ...previous, stage }));
    if (stage === "gift" && plan.giftLines.length) setStopId("gift");
    if (stage === "outfit")
      setStopId(
        plan.stops.find((stop) => stop.id.startsWith("wardrobe"))?.id || "",
      );
  };
  const stageNames = {
    route: L("路线", "Route"),
    outfit: L("试穿灵感", "Fitting"),
    gift: L("礼物准备", "Gifts"),
  };
  const stageTitle =
    preferences.stage === "gift"
      ? L("把心意，也放进行程。", "A little care, beautifully wrapped.")
      : preferences.stage === "outfit"
        ? L("先看灵感，再感受适合。", "Picture the fit. Feel it in person.")
        : L("一条为你留好余地的路线。", "A route with room for you.");
  return (
    <div
      className="visit-showcase visit-ai-workspace"
      data-visit-showcase
      data-visit-source={plan.source}
      data-plan-revision={plan.revision}
    >
      <div className="va-kicker">
        <span>A PERSONAL VISIT, CONSIDERED</span>
        <span>
          <i />
          {L("本地情境演示", "LOCAL SCENARIO DEMO")}
        </span>
      </div>
      <section
        className="va-workspace"
        aria-label={L("ÉDIT 到店规划工作区", "ÉDIT visit planning workspace")}
      >
        <section
          className="va-summary"
          aria-labelledby="va-title"
          data-plan-summary
        >
          <div className="va-region-label">
            <span>01 / YOUR VISIT</span>
            <span className="va-revision">
              {L("方案", "PLAN")} {String(plan.revision).padStart(2, "0")}
            </span>
          </div>
          <h1 id="va-title">
            {L("你的到店之旅，已开始。", "Your visit starts here.")}
          </h1>
          <p className="va-source">
            {plan.source === "recommended"
              ? L(
                  "先为你做好一份虚构案例方案。",
                  "A first plan, using your fictional reference case.",
                )
              : plan.source === "booking"
                ? L(
                    "沿用有效演示预约，调整本次路线。",
                    "Your active demo booking, thoughtfully replanned.",
                  )
                : L(
                    "从你的到店清单，先排好一条路线。",
                    "Your store list, made into a first route.",
                  )}
          </p>
          <dl className="va-facts">
            <div>
              <dt>{L("预计用时", "YOUR TIME")}</dt>
              <dd data-plan-minutes>
                {plan.minutes}
                <small> min</small>
              </dd>
            </div>
            <div>
              <dt>{L("沿途停留", "STOPS")}</dt>
              <dd data-plan-stop-count>
                {String(plan.stops.length).padStart(2, "0")}
              </dd>
            </div>
            <div>
              <dt>{L("参考单品", "PIECES")}</dt>
              <dd>{String(plan.lines.length).padStart(2, "0")}</dd>
            </div>
          </dl>
          <p className="va-first-stop" data-plan-first-stop>
            {L("先去", "FIRST STOP")}{" "}
            <strong>
              {firstVisitStop.floor}F ·{" "}
              {L(firstVisitStop.zh, firstVisitStop.en)}
            </strong>
          </p>
          <div className="va-summary-detail">
            <span>{L("虚构尺码参考", "FICTIONAL SIZE REFERENCE")}</span>
            <strong data-plan-size>
              {plan.sizeLabels.join(" / ") || L("无需尺码", "No size needed")}
            </strong>
            <span>{L("礼物安排", "GIFT NOTE")}</span>
            <strong data-plan-gift>
              {plan.giftLines.length
                ? `${L(packing.zh, packing.en)} · ${plan.sizePending ? L("尺码待确认", "Size to confirm") : L("仅预览", "Preview only")}`
                : L("尚未加入礼物停留", "No gift stop yet")}
            </strong>
          </div>
          {plan.omitted.length > 0 && (
            <p className="va-plan-note">
              {L(
                "家居体验暂留待下次，原清单不变。",
                "Home is set aside for another visit; your list is kept.",
              )}
            </p>
          )}
        </section>
        <section
          className={`va-conversation ${collapsed ? "is-collapsed" : ""}`}
          aria-labelledby="va-chat-title"
          data-plan-chat
        >
          <header className="va-chat-head">
            <div>
              <span className="va-region-label">02 / THE CONVERSATION</span>
              <h2 id="va-chat-title">
                {L("与 ÉDIT 一起安排", "Plan it with ÉDIT")}
              </h2>
            </div>
            <button
              type="button"
              onClick={toggleChat}
              aria-expanded={!collapsed}
              aria-label={
                collapsed
                  ? L("展开规划对话", "Expand planning conversation")
                  : L("收起规划对话", "Minimize planning conversation")
              }
            >
              {collapsed ? "+" : "−"}
            </button>
          </header>
          {collapsed ? (
            <button className="va-reopen" onClick={toggleChat}>
              {L(
                "方案已保留，继续聊聊",
                "Your plan is kept. Continue the conversation",
              )}
              <Arrow />
            </button>
          ) : (
            <>
              <div
                className="va-chat-log"
                ref={logRef}
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                tabIndex="0"
                aria-label={L("规划对话记录", "Planning conversation history")}
                onKeyDown={(event) => {
                  const node = event.currentTarget;
                  if (
                    event.target !== node ||
                    !["Home", "End", "PageUp", "PageDown"].includes(event.key)
                  )
                    return;
                  event.preventDefault();
                  node.scrollTop =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? node.scrollHeight
                        : node.scrollTop +
                          (event.key === "PageDown" ? 1 : -1) *
                            node.clientHeight *
                            0.85;
                }}
              >
                <article className="va-message is-assistant">
                  <span>
                    ÉDIT <small>{L("本地方案", "LOCAL PLAN")}</small>
                  </span>
                  <p>{initialMessage}</p>
                </article>
                {messages.map((message, index) => (
                  <article
                    className={`va-message is-${message.role}`}
                    key={index}
                  >
                    <span>
                      {message.role === "user" ? L("你", "YOU") : "ÉDIT"}{" "}
                      {message.role === "assistant" && (
                        <small>
                          {message.mode === "local"
                            ? L(
                                `本地方案 ${message.revision ? String(message.revision).padStart(2, "0") : ""}`,
                                `LOCAL PLAN ${message.revision ? String(message.revision).padStart(2, "0") : ""}`,
                              )
                            : message.mode === "gemini"
                              ? "GEMINI"
                              : "OPENAI GPT CLI"}
                        </small>
                      )}
                    </span>
                    <p>{message.text}</p>
                  </article>
                ))}
                {working && (
                  <p className="va-working" role="status">
                    {L(
                      "正在请求已授权的 AI 连接…",
                      "Requesting the authorized AI connection…",
                    )}
                  </p>
                )}
              </div>
              <div
                className="va-quick-choices"
                aria-label={L("快速调整行程", "Quick plan adjustments")}
              >
                {[
                  [L("30 分钟", "30 minutes"), preferences.duration === 30],
                  [L("先试鞋", "Shoes first"), preferences.shoesFirst],
                  [L("少走一点", "Less walking"), preferences.lessWalking],
                  [L("准备礼物", "Plan a gift"), preferences.giftFocus],
                ].map(([label, active]) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    disabled={working}
                    onClick={() => send(label)}
                  >
                    {label}
                    <span>↗</span>
                  </button>
                ))}
              </div>
              <form
                className="va-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <label className="sr-only" htmlFor="va-message">
                  {L("告诉 ÉDIT 你的安排", "Tell ÉDIT your plans")}
                </label>
                <input
                  id="va-message"
                  value={input}
                  maxLength={600}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={L(
                    "例如：30 分钟，先试鞋…",
                    "Try “30 minutes, shoes first”…",
                  )}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || working}
                  aria-label={L("发送规划消息", "Send planning message")}
                >
                  <Arrow />
                </button>
              </form>
              <p className="va-chat-mode">
                {liveConsent
                  ? L(
                      "本地路线推演 · 实时回复单独标注来源",
                      "LOCAL PLAN · LIVE REPLIES LABEL THEIR SOURCE",
                    )
                  : L(
                      "本地情境推演 · 未调用实时模型",
                      "LOCAL SCENARIO · NO LIVE MODEL CALL",
                    )}
              </p>
              {hasEndpoint && (
                <label className="va-ai-consent">
                  <input
                    type="checkbox"
                    checked={liveConsent}
                    onChange={(event) => setLiveConsent(event.target.checked)}
                  />
                  <span>
                    {openAI
                      ? L(
                          "同时将本次输入和目录编号发送给已配置的 OpenAI 测试连接。",
                          "Also send this message and catalog IDs to the configured OpenAI test connection.",
                        )
                      : L(
                          "同时将本次输入和目录编号发送给已配置的 Google Gemini。",
                          "Also send this message and catalog IDs to configured Google Gemini.",
                        )}
                  </span>
                </label>
              )}
            </>
          )}
        </section>
        <section
          className="va-visual"
          aria-labelledby="va-stage-title"
          data-plan-stage
          data-stage={preferences.stage}
        >
          <header className="va-stage-head">
            <div className="va-region-label">
              <span>03 / THE LIVE PLAN</span>
              <span>{L("随方案更新", "UPDATES WITH YOUR PLAN")}</span>
            </div>
            <div className="va-stage-title-row">
              <h2 id="va-stage-title">{stageTitle}</h2>
              <span className="va-update" role="status">
                {L("方案", "PLAN")} {String(plan.revision).padStart(2, "0")}
              </span>
            </div>
            <div
              className="va-stage-tabs"
              role="tablist"
              aria-label={L("规划画面", "Plan views")}
            >
              {stages.map((stage) => (
                <button
                  type="button"
                  role="tab"
                  id={`va-tab-${stage}`}
                  aria-controls="va-stage-panel"
                  aria-selected={preferences.stage === stage}
                  tabIndex={preferences.stage === stage ? 0 : -1}
                  key={stage}
                  onClick={() => setStage(stage)}
                  onKeyDown={(event) => {
                    if (
                      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    )
                      return;
                    event.preventDefault();
                    const index =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? 2
                          : (stages.indexOf(stage) +
                              (event.key === "ArrowRight" ? 1 : 2)) %
                            3;
                    setStage(stages[index]);
                    document.querySelector(`#va-tab-${stages[index]}`)?.focus();
                  }}
                >
                  {stageNames[stage]}
                </button>
              ))}
            </div>
          </header>
          <div
            className={`va-stage-panel is-${preferences.stage}`}
            id="va-stage-panel"
            role="tabpanel"
            aria-labelledby={`va-tab-${preferences.stage}`}
          >
            {preferences.stage === "route" ? (
              <RouteMap
                plan={plan}
                currentStop={currentStop}
                onStop={selectStop}
                L={L}
              />
            ) : preferences.stage === "outfit" ? (
              <div className="va-fitting-stage">
                <div className="va-photo-stage">
                  <img
                    src={stageImage}
                    alt={L(
                      fittingReference
                        ? "根据当前人物和目录单品选择的预制虚构穿搭场景"
                        : "原创虚构目录概念图，不是人物试穿",
                      fittingReference
                        ? "Pre-generated fictional styling selected for the current reference and catalog piece"
                        : "Original fictional catalog concept, not a fitting on a person",
                    )}
                  />
                  <div className="va-photo-caption">
                    <span>
                      {L(
                        fittingReference ? "预生成穿搭参考" : "原创目录概念图",
                        fittingReference
                          ? "PRE-GENERATED FITTING REFERENCE"
                          : "ORIGINAL CATALOG CONCEPT",
                      )}
                    </span>
                    <p>
                      {fittingReference
                        ? `${scenePersonaLabel} · ${L("非实时试衣", "Not a live try-on")}`
                        : wear
                          ? L(
                              "当前款式或颜色暂无预制试穿场景",
                              "No prepared fitting scene for this piece or colour",
                            )
                          : L(
                              "当前清单未选择服装试穿",
                              "No clothing selected for a fitting",
                            )}
                    </p>
                  </div>
                </div>
                <div className="va-fitting-notes">
                  <span>
                    {L("为本次试穿准备", "CONSIDERED FOR YOUR FITTING")}
                  </span>
                  <h3>
                    {wear
                      ? L(wear.product.name, wear.product.en)
                      : L("从喜欢的轮廓开始", "Begin with what you love")}
                  </h3>
                  <p>
                    {L(
                      fittingReference
                        ? "沿用本次虚构人物尺码参考，到店后再确认实际适合。"
                        : wear
                          ? "这个款式或颜色暂无预制人物场景。这里展示原始目录概念图。"
                          : "清单中还没有服装。可继续挑选，查看已有的预生成穿搭参考。",
                      fittingReference
                        ? "Your fictional size reference, with the real fit still to confirm in person."
                        : wear
                          ? "A prepared fitting scene is unavailable for this exact piece or colour. The original catalog concept is shown."
                          : "There are no clothing pieces in this plan. Keep exploring to see available pre-generated styling references.",
                    )}
                  </p>
                  <div className="va-fitting-pieces">
                    {plan.lines
                      .filter(
                        (line) =>
                          !line.gift?.isGift && line.fit?.kind !== "experience",
                      )
                      .slice(0, 4)
                      .map((line) => (
                        <button
                          type="button"
                          key={line.lineId}
                          onClick={() => onProduct?.(line.skuId)}
                        >
                          <img src={line.product.image} alt="" />
                          <span>
                            <strong>
                              {L(line.product.name, line.product.en)}
                            </strong>
                            <small>{tryListSizeLabel(line, L)}</small>
                          </span>
                        </button>
                      ))}
                  </div>
                  <p className="va-fitting-disclosure">
                    {L(
                      "预生成场景不会因尺码变化重绘。",
                      "This pre-generated scene is not redrawn when a size changes.",
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="va-gift-stage">
                <div className="va-gift-photo">
                  <img
                    src={packing.image}
                    alt={L(packing.detailZh, packing.detailEn)}
                  />
                  <span>
                    {L("预制礼盒概念图", "PRE-GENERATED PACKAGING CONCEPT")}
                  </span>
                </div>
                <div className="va-gift-copy">
                  <span>THE GIFT SALON · 1F</span>
                  <h3>{L(packing.zh, packing.en)}</h3>
                  <p>
                    {plan.giftLines.length
                      ? plan.sizePending
                        ? L(
                            "先确认受赠人尺码，再考虑包装。",
                            "Confirm the recipient’s size before wrapping.",
                          )
                        : L(
                            "礼物偏好已放入路线，包装尚未实际完成。",
                            "Gift preferences are part of the route. Nothing has been wrapped.",
                          )
                      : L(
                          "可先聊聊礼物，加入一次礼物厅停留。",
                          "Tell ÉDIT about a gift to add a salon stop.",
                        )}
                  </p>
                  <div
                    className="va-packaging-choices"
                    role="group"
                    aria-label={L("礼盒概念选择", "Packaging concept choices")}
                  >
                    {giftPackagingOptions.map((option) => (
                      <button
                        type="button"
                        key={option.id}
                        aria-pressed={packing.id === option.id}
                        onClick={() =>
                          send(
                            L(
                              `礼物用${option.zh}`,
                              `Gift with ${option.id === "ivory-silk" ? "silk" : option.id === "recycled-cotton" ? "cotton" : "botanical"} wrapping`,
                            ),
                          )
                        }
                      >
                        {L(option.zh, option.en)}
                      </button>
                    ))}
                  </div>
                  <p className="va-gift-status">
                    {L(
                      "演示预览 · 未备货 · 未实际包装",
                      "DEMO PREVIEW · NO STOCK RESERVED · NOT WRAPPED",
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div
            className="va-route-strip"
            aria-label={L("当前路线站点", "Current itinerary stops")}
            data-plan-route
          >
            {plan.stops.map((stop, index) => (
              <button
                key={stop.id}
                type="button"
                onClick={() => selectStop(stop)}
                aria-pressed={currentStop.id === stop.id}
                data-visit-stop={stop.id}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{L(stop.zh, stop.en)}</strong>
                <small>
                  {stop.time} · {stop.floor}F · {stop.minutes} min
                </small>
              </button>
            ))}
          </div>
          <div
            className="va-current-stop"
            data-current-visit-stop={currentStop.id}
          >
            <div>
              <span>
                {currentStop.floor}F / {currentStop.counters.join(" · ")}
              </span>
              <h3>{L(currentStop.zh, currentStop.en)}</h3>
            </div>
            <p>
              {currentStop.id === "welcome"
                ? L(
                    "中央中庭核对路线，按你的节奏出发。",
                    "Begin in the central atrium. Take the route at your pace.",
                  )
                : currentStop.id === "gift"
                  ? L(
                      "核对礼物、受赠人尺码与包装偏好。",
                      "Review the gift, recipient size and wrapping preferences.",
                    )
                  : currentStop.items
                      .map((line) => L(line.product.name, line.product.en))
                      .join(" · ")}
            </p>
          </div>
        </section>
      </section>
      <section
        className="va-list-foot"
        aria-label={L("本次行程单品", "Pieces in this plan")}
      >
        <div className="va-persona">
          <img src={plan.persona.image} alt="" />
          <span>
            {L("本次虚构参考", "FICTIONAL REFERENCE")}
            <strong>{L(plan.persona.zh, plan.persona.en)}</strong>
          </span>
        </div>
        <div className="va-piece-buttons">
          {plan.lines.map((line) => (
            <button
              key={line.lineId}
              type="button"
              onClick={() => onProduct?.(line.skuId)}
              aria-label={L(
                `查看${line.product.name}`,
                `View ${line.product.en}`,
              )}
            >
              <img src={line.product.image} alt="" />
              <span>{L(line.product.name, line.product.en)}</span>
            </button>
          ))}
        </div>
        <button
          className="va-list-action"
          onClick={plan.source === "recommended" ? onExplore : onBag}
        >
          {plan.source === "recommended"
            ? L("继续挑选", "Keep exploring")
            : L("查看到店清单", "Review your list")}
          <Arrow />
        </button>
      </section>
      <p className="va-disclosure">
        {L(
          "本地演示规划，地图随输入重新编排；人物、穿搭与礼盒为预生成参考。未联系真实门店，未创建真实预约或留货。",
          "A local planning demo. The route is recalculated from your input; people, outfits and wrapping are pre-generated references. No real store is contacted, booking made or stock reserved.",
        )}
        {plan.booking &&
          L(
            " 路线用时调整不改变已保存的演示预约。",
            " Route timing does not change your saved demo booking.",
          )}
      </p>
    </div>
  );
}
