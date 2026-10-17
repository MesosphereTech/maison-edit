import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  SubtitleConcierge,
  useBubbleStream,
} from "../../src/SubtitleConcierge.jsx";
import "../../src/styles.css";
function Harness() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "A quiet greeting." },
  ]);
  const [attentionKey, setAttentionKey] = useState("ME-001");
  const [contextKey, setContextKey] = useState("first");
  const [input, setInput] = useState("");
  const stream = useBubbleStream(messages, false, contextKey, attentionKey);
  window.addTestBubble = (options = {}) =>
    setMessages((lines) => [
      ...lines,
      {
        role: "assistant",
        text: `Prepared reply ${lines.length}.`,
        visualText: `Short reply ${lines.length}.`,
        quickReplies: [],
        ...options,
      },
    ]);
  window.retireTestAttention = () => setAttentionKey("ME-002");
  window.changeTestContext = () => setContextKey("next");
  window.getTestHistoryCount = () => messages.length;
  window.expireTestBubble = () => {
    const originalNow = Date.now;
    Date.now = () => originalNow() + 22000;
  };
  return (
    <>
      <div
        id="source"
        data-concierge-product="ME-001"
        style={{ margin: 80, width: 260, height: 380 }}
      >
        A visible fictional product
      </div>
      <div style={{ height: 1500 }} />
      <SubtitleConcierge
        L={(_, en) => en}
        message={messages.at(-1)}
        transcript={messages}
        state="active"
        paused={false}
        working={false}
        input={input}
        mode="subtitles"
        onMode={() => {}}
        onInput={setInput}
        onSend={() => {}}
        onPause={() => {}}
        onMinimize={() => {}}
        onDismiss={() => {}}
        onResume={() => {}}
        onQuick={() => {}}
        onConversation={() => {}}
        onProduct={() => {}}
        stream={stream}
      />
    </>
  );
}
createRoot(document.getElementById("root")).render(<Harness />);
