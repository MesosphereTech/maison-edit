import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import {
  MUSIC_TRACKS,
  musicPreferences,
  resolveMusicTrack,
  musicArrivalPreferences,
  nextMusicTrack,
} from "../src/store-music.js";
import { initialState, restoreState } from "../src/data.js";

test("the private soundtrack contains three local recordings with public source credits", async () => {
  assert.equal(MUSIC_TRACKS.length, 3);
  assert.equal(new Set(MUSIC_TRACKS.map((track) => track.id)).size, 3);
  assert.equal(new Set(MUSIC_TRACKS.map((track) => track.src)).size, 3);
  for (const track of MUSIC_TRACKS) {
    assert.match(track.src, /^\/music\/[a-z0-9-]+\.mp3$/);
    assert.match(track.source, /^https:\/\/suno\.com\/song\/[a-f0-9-]+$/);
    assert.ok(
      track.title && track.zh && track.description && track.descriptionZh,
    );
    assert.match(track.duration, /^\d+:\d{2}$/);
    assert.ok(track.durationSeconds > 60 && track.durationSeconds < 600);
    const path = new URL(`../public${track.src}`, import.meta.url);
    assert.ok((await stat(path)).size > 100_000);
    const bytes = await readFile(path);
    assert.ok(
      bytes.subarray(0, 3).toString() === "ID3" ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
      "an MP3 header must replace any download error HTML",
    );
  }
});

test("music defaults on, migrates safely and remembers an explicit pause or mute", () => {
  const defaultTrack = MUSIC_TRACKS[0].id;
  assert.deepEqual(musicPreferences(), {
    soundTrack: defaultTrack,
    soundEnabled: true,
    soundMuted: false,
  });
  assert.deepEqual(
    musicPreferences({
      soundTrack: "https://example.com/private.mp3",
      soundMuted: "true",
      playing: true,
    }),
    { soundTrack: defaultTrack, soundEnabled: true, soundMuted: false },
  );
  assert.deepEqual(
    musicPreferences({
      soundTrack: MUSIC_TRACKS[1].id,
      soundEnabled: false,
      soundMuted: true,
    }),
    { soundTrack: MUSIC_TRACKS[1].id, soundEnabled: false, soundMuted: true },
  );
  assert.equal(resolveMusicTrack("bad-id"), MUSIC_TRACKS[0]);
  const saved = {
    ...initialState(),
    soundTrack: MUSIC_TRACKS[2].id,
    soundMuted: true,
    soundEnabled: false,
    soundVolume: 0.23,
    playing: true,
  };
  const restored = restoreState(saved).state;
  assert.equal(restored.soundTrack, MUSIC_TRACKS[2].id);
  assert.equal(restored.soundMuted, true);
  assert.equal(restored.soundEnabled, false);
  assert.equal(restored.soundVolume, 0.23);
  assert.equal("playing" in restored, false);
  assert.equal("ambient" in restored, false);
});

test("each full page arrival restarts enabled and unmuted while retaining track and positive volume", () => {
  const saved = {
    soundTrack: "gallery",
    soundEnabled: false,
    soundMuted: true,
    soundVolume: 0.23,
  };
  assert.deepEqual(musicArrivalPreferences(saved), {
    soundTrack: "gallery",
    soundEnabled: true,
    soundMuted: false,
    soundVolume: 0.23,
  });
  assert.deepEqual(saved, {
    soundTrack: "gallery",
    soundEnabled: false,
    soundMuted: true,
    soundVolume: 0.23,
  });
  for (const soundVolume of [0, -1, NaN, Infinity, undefined])
    assert.equal(musicArrivalPreferences({ soundVolume }).soundVolume, 0.18);
  assert.equal(musicArrivalPreferences({ soundVolume: 0.9 }).soundVolume, 0.5);
  assert.equal(
    musicPreferences(saved).soundEnabled,
    false,
    "in-page preferences still respect explicit pause",
  );
  assert.equal(
    musicPreferences(saved).soundMuted,
    true,
    "in-page preferences still respect explicit mute",
  );
});
test("the soundtrack advances through each recording and wraps without a single-track loop", () => {
  assert.equal(nextMusicTrack("atrium").id, "gallery");
  assert.equal(nextMusicTrack("gallery").id, "salon");
  assert.equal(nextMusicTrack("salon").id, "atrium");
  assert.equal(nextMusicTrack("unknown").id, "atrium");
});
