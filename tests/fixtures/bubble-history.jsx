import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import { SubtitleConcierge } from "../../src/SubtitleConcierge.jsx";

const start = Array.from({ length: 20 }, (_, index) => ({
  role: index % 2 ? "user" : "assistant",
  text: `History turn ${index + 1}. ${"A considered conversation about pieces, colours and the room. ".repeat(3)}`,
}));
start.push({
  role: "assistant",
  text: "Current guide reply.",
  visualText: "Current short bubble.",
  productIds: ["ME-001"],
  ownedProductIds: ["ME-001"],
  quickReplies: [{ id: "view", label: "View the piece" }],
});
function Harness() {
  const [transcript, setTranscript] = useState(start);
  const [bubbles, setBubbles] = useState(() =>
    start.slice(-1).map((line, index) => ({
      ...line,
      id: `line-${start.length - 1 + index}`,
      remaining: 20000,
    })),
  );
  const [input, setInput] = useState("");
  const [state, setState] = useState("active");
  const setHeld = useCallback((held) => {
    window.historyHeld = held;
  }, []);
  const event = (name) => () => {
    window.historyActions.push(name);
  };
  window.historyActions ||= [];
  window.appendHistoryTurn = () =>
    setTranscript((lines) => {
      const next = {
        role: "assistant",
        text: `New guide reply ${lines.length + 1}.`,
        productIds: ["ME-001"],
        quickReplies: [{ id: "view", label: "View the piece" }],
      };
      setBubbles([{ ...next, id: `line-${lines.length}`, remaining: 20000 }]);
      return [...lines, next];
    });
  window.updateLiveHistory = () =>
    setTranscript((lines) =>
      lines.map((line, index) =>
        index === lines.length - 1
          ? {
              ...line,
              text: `${line.text} Live content has changed. ${"More detail. ".repeat(30)}`,
            }
          : line,
      ),
    );
  window.updateEarlierHistory = () =>
    setTranscript((lines) =>
      lines.map((line, index) =>
        index === 0
          ? {
              ...line,
              text: `${line.text} ${"Earlier expanded detail. ".repeat(30)}`,
            }
          : line,
      ),
    );
  window.getHistoryCount = () => transcript.length;
  return (
    <div
      className={
        new URLSearchParams(location.search).has("overlay") ? "overlay" : ""
      }
    >
      <SubtitleConcierge
        L={(_, english) => english}
        message={transcript.at(-1)}
        transcript={transcript}
        state={state}
        paused={false}
        working={false}
        input={input}
        mode="subtitles"
        onMode={event("mode")}
        onInput={setInput}
        onSend={event("send")}
        onPause={event("pause")}
        onMinimize={() => setState("minimized")}
        onDismiss={() => setState("dismissed")}
        onResume={() => setState("active")}
        onQuick={event("quick")}
        onConversation={event("conversation")}
        onProduct={event("product")}
        stream={{
          bubbles,
          scrolling: false,
          setHeld,
          dismiss: (id) => {
            window.historyActions.push("dismiss");
            setBubbles((current) => current.filter((line) => line.id !== id));
          },
        }}
      />
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Harness />);
