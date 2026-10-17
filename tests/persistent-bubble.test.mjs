import test from "node:test";
import assert from "node:assert/strict";
import {
  revealPhrases,
  findBlankPlacement,
  placementOverlap,
} from "../src/bubble-motion.js";

test("phrase reveal preserves English and Chinese copy verbatim", () => {
  for (const copy of [
    "A considered wool coat, with a soft line. It works with your existing knitwear.",
    "这件羊毛大衣的线条简洁，能搭配你已经拥有的针织衫。细节会慢慢显现。",
    "  Keep original spacing.  Even across a line.\nAnd punctuation!",
  ]) {
    const phrases = revealPhrases(copy);
    assert.equal(phrases.join(""), copy);
    assert.ok(phrases.length > 1);
    assert.ok(phrases.every((phrase) => phrase.length <= 32));
  }
  assert.deepEqual(revealPhrases(""), [""]);
});
test("blank placement stays inside the viewport and clears product, text and input", () => {
  const obstacles = [
    { left: 30, top: 60, right: 460, bottom: 560 },
    { left: 720, top: 70, right: 990, bottom: 520 },
    { left: 300, top: 650, right: 700, bottom: 710 },
  ];
  const destination = findBlankPlacement({
    width: 1024,
    height: 768,
    panelWidth: 232,
    panelHeight: 142,
    obstacles,
    preferred: { left: 396, top: 490 },
    top: 20,
  });
  assert.ok(destination);
  assert.ok(destination.left >= 12 && destination.right <= 1012);
  assert.ok(destination.top >= 20 && destination.bottom <= 756);
  assert.ok(
    obstacles.every((obstacle) => !placementOverlap(destination, obstacle)),
  );
});
test("a full content viewport never pretends to have a blank rectangle", () => {
  assert.equal(
    findBlankPlacement({
      width: 320,
      height: 600,
      panelWidth: 232,
      panelHeight: 142,
      obstacles: [{ left: 0, top: 0, right: 320, bottom: 600 }],
      preferred: { left: 44, top: 400 },
    }),
    null,
  );
});
