import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import {
  SubtitleConcierge,
  useBubbleStream,
} from "../../src/SubtitleConcierge.jsx";

function Harness() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "A quiet greeting." },
  ]);
  const [attention, setAttention] = useState(null);
  const [contextKey, setContextKey] = useState("first");
  const [input, setInput] = useState("");
  const [state, setState] = useState("active");
  const serial = useRef(0);
  const stream = useBubbleStream(
    messages,
    state !== "active",
    contextKey,
    attention?.key || "",
  );
  const update = (
    id = "ME-001",
    text = "A considered piece, with a clean and quiet line. The texture works with the pieces already in your wardrobe.",
  ) => {
    const element = document.querySelector(`[data-concierge-product="${id}"]`);
    const rect = element.getBoundingClientRect();
    setAttention({ key: id, token: ++serial.current, rect, element });
    setMessages((lines) => [
      ...lines,
      {
        role: "assistant",
        text,
        source: { passive: true, productId: id },
        productIds: [id],
        quickReplies: [],
      },
    ]);
  };
  window.updatePersistentBubble = update;
  window.changePersistentContext = () => {
    setContextKey("next");
    setAttention(null);
  };
  window.jumpPersistentClock = () => {
    const now = Date.now;
    Date.now = () => now() + 86400000;
  };
  window.getPersistentTranscript = () => messages;
  return (
    <>
      <header
        className="site-header"
        style={{
          height: 64,
          minHeight: 64,
          position: "fixed",
          top: 0,
          width: "100%",
        }}
      >
        MAISON ÉDIT
      </header>
      <main style={{ minHeight: 1800, padding: "100px 20px" }}>
        <div
          className="product-card"
          data-concierge-product="ME-001"
          style={{
            position: "relative",
            width: "min(440px, calc(100vw - 40px))",
            margin: "0 0 0 max(0px, calc(8vw - 20px))",
          }}
        >
          <div
            className="product-visual"
            style={{ height: 300, aspectRatio: "auto" }}
          >
            <button
              className="product-image-button"
              onClick={() => update("ME-001")}
              aria-label="Inspect first product"
            >
              Inspect the first product
            </button>
            <button
              className="scene-swap-button"
              onClick={(event) => event.stopPropagation()}
              aria-label="Swap product image"
              style={{ position: "absolute", right: 10, top: 10 }}
            >
              Swap image
            </button>
          </div>
          <div className="product-info">
            <button onClick={() => update("ME-001")}>First piece</button>
          </div>
        </div>
        <div
          data-concierge-product="ME-002"
          style={{ width: 200, height: 80, marginTop: 24 }}
        >
          <button
            onClick={() =>
              update(
                "ME-002",
                "The second piece has a different silhouette. A fresh line appears in the same quiet conversation.",
              )
            }
          >
            Second piece
          </button>
        </div>
      </main>
      <SubtitleConcierge
        L={(_, en) => en}
        message={messages.at(-1)}
        transcript={messages}
        attention={attention}
        state={state}
        paused={false}
        working={false}
        input={input}
        mode="subtitles"
        onMode={() => {}}
        onInput={setInput}
        onSend={() => {}}
        onPause={() => {}}
        onMinimize={() => setState("minimized")}
        onDismiss={() => setState("dismissed")}
        onResume={() => setState("active")}
        onQuick={() => {}}
        onConversation={() => {}}
        onProduct={() => {}}
        stream={stream}
      />
    </>
  );
}
createRoot(document.getElementById("root")).render(<Harness />);
