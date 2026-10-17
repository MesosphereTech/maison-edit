import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  MUSIC_TRACKS,
  resolveMusicTrack,
  nextMusicTrack,
} from "./store-music.js";

function TransportIcon({ paused }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      {paused ? (
        <path d="m8 5 11 7-11 7Z" fill="currentColor" />
      ) : (
        <path d="M7 5h3v14H7zm7 0h3v14h-3z" fill="currentColor" />
      )}
    </svg>
  );
}

export default function StoreMusic({
  state,
  update,
  L,
  Modal,
  Icon,
  onOpenChange,
}) {
  const panelChange = useRef(onOpenChange);
  panelChange.current = onOpenChange;
  const preferences = useRef(state);
  preferences.current = state;
  const save = useRef(update);
  save.current = update;
  const audioRef = useRef(null);
  const sourceRef = useRef("");
  const requestRef = useRef(0);
  const intentRef = useRef(false);
  // Arm the first trusted interaction at commit, before an asynchronous
  // autoplay denial or the setup/guide can consume that interaction.
  const activationPendingRef = useRef(true);
  const statusRef = useRef("paused");
  const [status, setStatus] = useState("paused");
  const [open, setOpen] = useState(false);
  const track = resolveMusicTrack(state.soundTrack);
  const active = ["playing", "loading", "waiting"].includes(status);
  const setPlaybackStatus = useCallback((value) => {
    statusRef.current = value;
    setStatus(value);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    panelChange.current?.(false);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = state.soundVolume;
    audio.muted = state.soundMuted;
  }, [state.soundVolume, state.soundMuted]);

  useEffect(() => {
    // A full local-data reset can change the saved selection outside the sheet.
    if (!sourceRef.current || sourceRef.current === track?.id) return;
    requestRef.current += 1;
    intentRef.current = false;
    audioRef.current?.pause();
    sourceRef.current = "";
    setPlaybackStatus("paused");
  }, [track?.id, setPlaybackStatus]);

  const pause = useCallback(
    (remember = true) => {
      requestRef.current += 1;
      intentRef.current = false;
      activationPendingRef.current = false;
      audioRef.current?.pause();
      setPlaybackStatus("paused");
      if (remember)
        save.current((saved) => ({ ...saved, soundEnabled: false }));
    },
    [setPlaybackStatus],
  );

  const play = useCallback(
    async (
      nextTrack = resolveMusicTrack(preferences.current.soundTrack),
      remember = true,
      allowGestureRetry = false,
    ) => {
      const audio = audioRef.current;
      if (!audio || !nextTrack) return;
      const request = ++requestRef.current;
      if (!allowGestureRetry) activationPendingRef.current = false;
      intentRef.current = true;
      setPlaybackStatus("loading");
      if (remember) save.current((saved) => ({ ...saved, soundEnabled: true }));
      try {
        // Try on arrival. If the browser needs activation, retry synchronously
        // within the first real interaction instead of claiming playback began.
        if (sourceRef.current !== nextTrack.id) {
          audio.pause();
          sourceRef.current = nextTrack.id;
          audio.src = nextTrack.src;
          audio.load();
        }
        audio.volume = preferences.current.soundVolume;
        audio.muted = preferences.current.soundMuted;
        await audio.play();
        if (request !== requestRef.current || !intentRef.current) return;
        activationPendingRef.current = false;
        setPlaybackStatus(audio.paused ? "paused" : "playing");
      } catch (error) {
        if (request !== requestRef.current) return;
        audio.pause();
        if (error?.name === "NotAllowedError") {
          if (
            intentRef.current &&
            allowGestureRetry &&
            !preferences.current.soundMuted &&
            preferences.current.soundVolume > 0
          ) {
            setPlaybackStatus("waiting");
            return;
          }
          intentRef.current = false;
          activationPendingRef.current = false;
          setPlaybackStatus(
            preferences.current.soundMuted ? "paused" : "blocked",
          );
          return;
        }
        intentRef.current = false;
        activationPendingRef.current = false;
        // Retry is available. A failed recording is never replaced with another
        // track, a remote stream, or the previous oscillator soundtrack.
        sourceRef.current = "";
        setPlaybackStatus("error");
      }
    },
    [setPlaybackStatus],
  );

  useEffect(() => {
    let mounted = true;
    const audio = audioRef.current;
    // Deferring one microtask coalesces React StrictMode's setup/cleanup/setup
    // into one attempt, without leaking a play after a genuine unmount.
    queueMicrotask(() => {
      const saved = preferences.current;
      if (
        mounted &&
        activationPendingRef.current &&
        !intentRef.current &&
        saved.soundEnabled !== false &&
        !saved.soundMuted &&
        saved.soundVolume > 0
      )
        play(undefined, false, true);
    });
    return () => {
      mounted = false;
      requestRef.current += 1;
      intentRef.current = false;
      audio?.pause();
    };
  }, [play]);

  useEffect(() => {
    if (state.soundEnabled === false && intentRef.current) pause(false);
    else if (
      (state.soundMuted || state.soundVolume === 0) &&
      statusRef.current === "waiting"
    )
      pause(false);
  }, [state.soundEnabled, state.soundMuted, state.soundVolume, pause]);

  useLayoutEffect(() => {
    const retry = (event) => {
      const saved = preferences.current;
      const pending =
        activationPendingRef.current &&
        (statusRef.current === "waiting" ||
          statusRef.current === "paused" ||
          (statusRef.current === "loading" && audioRef.current?.paused));
      if (
        !event.isTrusted ||
        event.defaultPrevented ||
        !pending ||
        saved.soundEnabled === false ||
        saved.soundMuted ||
        saved.soundVolume === 0 ||
        event.target?.closest?.("[data-store-music-ui]") ||
        (event.type === "keydown" &&
          (event.repeat ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            ["Escape", "Shift", "Control", "Alt", "Meta"].includes(event.key)))
      )
        return;
      // play() marks loading before yielding, so a touchend/click pair or
      // repeated keys cannot enqueue duplicate playback attempts.
      play(undefined, false);
    };
    const events = ["click", "touchend", "keydown"];
    // Capture runs before setup/guide controls stop bubbling or prevent default.
    // The ref disarms synchronously, so touchend/click never double-start it.
    events.forEach((name) => document.addEventListener(name, retry, true));
    return () =>
      events.forEach((name) => document.removeEventListener(name, retry, true));
  }, [play]);

  const toggleMute = useCallback(() => {
    const saved = preferences.current;
    const muted = !saved.soundMuted;
    // Cancel an armed retry immediately when mute is pressed, before React's
    // next render and before the gesture reaches a document listener.
    if (muted && statusRef.current === "waiting") pause(false);
    save.current((current) => ({ ...current, soundMuted: muted }));
    if (
      !muted &&
      saved.soundEnabled !== false &&
      !intentRef.current &&
      saved.soundVolume > 0
    )
      play();
  }, [pause, play]);

  useEffect(() => {
    // The mandatory setup dialog mirrors mute because native modal dialogs
    // make the floating player inert until the visitor enters the storefront.
    document.addEventListener("maison:toggle-music-mute", toggleMute);
    return () =>
      document.removeEventListener("maison:toggle-music-mute", toggleMute);
  }, [toggleMute]);

  useEffect(() => {
    document.dispatchEvent(
      new CustomEvent("maison:music-muted", {
        detail: { muted: state.soundMuted },
      }),
    );
  }, [state.soundMuted]);

  const toggle = () => (active ? pause() : play());
  const choose = (id) => {
    if (id === track?.id) return;
    const next = resolveMusicTrack(id);
    const continuePlaying = intentRef.current;
    pause(false);
    update((saved) => ({ ...saved, soundTrack: next.id }));
    if (continuePlaying) play(next);
  };
  const statusText =
    status === "error"
      ? L(
          "暂时无法播放，请重试或选择其他曲目。",
          "Music is unavailable. Retry or choose another track.",
        )
      : status === "waiting"
        ? L("音乐已开启 · 轻触页面后播放", "Music is on · interact to start")
        : status === "blocked"
          ? L(
              "浏览器尚未允许播放，请点击播放。",
              "Your browser needs a tap on Play.",
            )
          : status === "loading"
            ? L("正在载入音乐…", "Loading music…")
            : status === "playing"
              ? state.soundMuted || state.soundVolume === 0
                ? L("播放中 · 已静音", "Playing · muted")
                : L("播放中", "Playing")
              : L("已暂停 · 点击播放", "Paused · press play");
  const playLabel = active
    ? L("暂停店内音乐", "Pause store music")
    : status === "error"
      ? L("重试播放店内音乐", "Retry store music")
      : L("播放店内音乐", "Play store music");

  return (
    <>
      <audio
        ref={audioRef}
        data-store-music
        preload="none"
        onEnded={() => {
          // The same mounted audio element advances only while the visitor's
          // current-page playback intent remains active. Pause never advances.
          if (
            !intentRef.current ||
            preferences.current.soundEnabled === false ||
            !audioRef.current?.ended
          )
            return;
          const next = nextMusicTrack(sourceRef.current);
          if (!next) return;
          save.current((saved) => ({ ...saved, soundTrack: next.id }));
          play(next, false);
        }}
        onPlaying={() => {
          if (intentRef.current && !audioRef.current?.paused)
            setPlaybackStatus("playing");
          else audioRef.current?.pause();
        }}
        onPause={() => {
          if (
            audioRef.current?.paused &&
            !audioRef.current?.ended &&
            !["loading", "waiting", "blocked"].includes(statusRef.current)
          ) {
            intentRef.current = false;
            if (statusRef.current !== "error") setPlaybackStatus("paused");
          }
        }}
        onWaiting={() => {
          if (
            intentRef.current &&
            !["waiting", "blocked"].includes(statusRef.current)
          )
            setPlaybackStatus("loading");
        }}
        onError={() => {
          if (!intentRef.current || !audioRef.current?.error) return;
          requestRef.current += 1;
          intentRef.current = false;
          sourceRef.current = "";
          setPlaybackStatus("error");
        }}
      />
      <div
        className="music-control"
        data-music-status={status}
        data-store-music-ui
      >
        <button
          className="music-transport"
          onClick={toggle}
          aria-label={playLabel}
          aria-pressed={active}
          aria-busy={status === "loading"}
          disabled={!track}
        >
          <TransportIcon paused={!active} />
        </button>
        <button
          className="music-settings-button"
          onClick={() => {
            setOpen(true);
            panelChange.current?.(true);
          }}
          aria-label={L("店内音乐与曲目", "Store music and tracks")}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span>{L("店内音乐", "STORE MUSIC")}</span>
          <span>
            {status === "error"
              ? L("暂时无法播放", "Unavailable")
              : status === "waiting"
                ? L("轻触后播放", "Tap to start")
                : status === "blocked"
                  ? L("请点击播放", "Press play")
                  : status === "loading"
                    ? L("正在载入…", "Loading…")
                    : track
                      ? L(track.zh, track.title)
                      : L("尚未准备好", "Not ready")}
          </span>
        </button>
        <button
          className="music-transport music-quick-mute"
          onClick={toggleMute}
          aria-label={
            state.soundMuted
              ? L("取消音乐静音", "Unmute store music")
              : L("将音乐静音", "Mute store music")
          }
          aria-pressed={state.soundMuted}
          title={state.soundMuted ? L("取消静音", "Unmute") : L("静音", "Mute")}
        >
          <Icon name={state.soundMuted ? "muted" : "sound"} size={17} />
        </button>
      </div>
      {open &&
        createPortal(
          <Modal
            title={L("聆听片刻。", "The listening room.")}
            eyebrow="MAISON ÉDIT · SOUNDTRACK"
            onClose={close}
            className="music-overlay"
          >
            <div className="music-settings" data-store-music-ui>
              <p className="music-intro">
                {L(
                  "三段纯器乐，为慢慢逛店而选。",
                  "Three instrumentals, for an unhurried visit.",
                )}
              </p>
              <fieldset className="music-tracks">
                <legend>{L("选择曲目", "Choose an instrumental")}</legend>
                {MUSIC_TRACKS.map((item, index) => (
                  <label
                    key={item.id}
                    className={track?.id === item.id ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="store-music-track"
                      value={item.id}
                      checked={track?.id === item.id}
                      onChange={() => choose(item.id)}
                    />
                    <span className="music-track-number">0{index + 1}</span>
                    <span className="music-track-copy">
                      <strong>{L(item.zh, item.title)}</strong>
                      <span>{L(item.descriptionZh, item.description)}</span>
                    </span>
                    <span className="music-track-duration">
                      {item.duration}
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="music-settings-transport">
                <button
                  className="music-play-button"
                  onClick={toggle}
                  aria-label={playLabel}
                  disabled={!track}
                >
                  <TransportIcon paused={!active} />
                  {active
                    ? L("暂停", "Pause")
                    : status === "error"
                      ? L("重试", "Retry")
                      : L("播放", "Play")}
                </button>
                <button
                  className="music-mute-button"
                  onClick={toggleMute}
                  aria-label={
                    state.soundMuted
                      ? L("取消音乐静音", "Unmute store music")
                      : L("将音乐静音", "Mute store music")
                  }
                  aria-pressed={state.soundMuted}
                >
                  <Icon name={state.soundMuted ? "muted" : "sound"} size={17} />
                  {state.soundMuted
                    ? L("取消静音", "Unmute")
                    : L("静音", "Mute")}
                </button>
              </div>
              <label className="music-volume">
                <span>{L("音乐音量", "Music volume")}</span>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.01"
                  value={state.soundVolume}
                  onChange={(event) =>
                    update((saved) => ({
                      ...saved,
                      soundVolume: Number(event.target.value),
                    }))
                  }
                />
                <output>{Math.round(state.soundVolume * 100)}%</output>
              </label>
              <p className="music-status" role="status" aria-live="polite">
                {statusText}
              </p>
              <div className="music-credit">
                <p>
                  {L(
                    "由 Suno 生成的 AI 音乐。仅限个人、非商业测试。",
                    "AI-generated with Suno. Personal, non-commercial testing only.",
                  )}
                </p>
                <p>
                  <a href="https://suno.com" target="_blank" rel="noreferrer">
                    Made with Suno
                  </a>
                  {track && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={track.source} target="_blank" rel="noreferrer">
                        {L("在 Suno 查看此曲", "View this track on Suno")}
                      </a>
                    </>
                  )}
                </p>
              </div>
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}
