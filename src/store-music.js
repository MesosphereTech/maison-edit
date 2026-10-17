// Filled only with the three verified, officially downloaded Suno recordings.
// No synthesized or remote-stream fallback is used by the player.
export const MUSIC_TRACKS = [
  {
    id: "atrium",
    title: "Atrium",
    zh: "中庭",
    description: "An instrumental for the first discoveries.",
    descriptionZh: "为初入店的发现，留一段纯器乐。",
    src: "/music/atrium.mp3",
    source: "https://suno.com/song/1b5b61ba-744c-4855-9311-c297ec7d8e30",
    duration: "3:58",
    durationSeconds: 238,
  },
  {
    id: "gallery",
    title: "Gallery",
    zh: "艺廊",
    description: "An instrumental for a slower look.",
    descriptionZh: "慢慢看，慢慢选的一段纯器乐。",
    src: "/music/gallery.mp3",
    source: "https://suno.com/song/155e1c48-c301-4a5f-879a-61ff7eec3bf5",
    duration: "3:53",
    durationSeconds: 233,
  },
  {
    id: "salon",
    title: "Salon",
    zh: "沙龙",
    description: "An instrumental for an unhurried pause.",
    descriptionZh: "为不急着离开的片刻，留一段纯器乐。",
    src: "/music/salon.mp3",
    source: "https://suno.com/song/34d0229f-a8b2-41f2-8698-867970fbf188",
    duration: "3:03",
    durationSeconds: 183,
  },
];

export function resolveMusicTrack(id) {
  return (
    MUSIC_TRACKS.find((track) => track.id === id) || MUSIC_TRACKS[0] || null
  );
}

export function musicPreferences(saved = {}) {
  return {
    soundTrack: resolveMusicTrack(saved.soundTrack)?.id || "",
    // Existing visitors adopt default-on music; an explicit pause stays paused.
    soundEnabled: saved.soundEnabled !== false,
    soundMuted: saved.soundMuted === true,
  };
}

// A full page load is a new listening session. In-page transport choices are
// still kept by musicPreferences; navigation never invokes this boot policy.
export function musicArrivalPreferences(saved = {}) {
  return {
    ...musicPreferences(saved),
    soundEnabled: true,
    soundMuted: false,
    soundVolume:
      Number.isFinite(saved.soundVolume) && saved.soundVolume > 0
        ? Math.min(0.5, saved.soundVolume)
        : 0.18,
  };
}

export function nextMusicTrack(id) {
  const index = MUSIC_TRACKS.findIndex((track) => track.id === id);
  return (
    MUSIC_TRACKS[index < 0 ? 0 : (index + 1) % MUSIC_TRACKS.length] || null
  );
}
