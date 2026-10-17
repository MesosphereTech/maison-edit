import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));

test("one matching SKU renders once with a truthful finite end, without automatic repeat controls", async () => {
  await mkdir(join(root, "artifacts"), { recursive: true });
  const directory = await mkdtemp(join(root, "artifacts", "single-feed-test-"));
  const output = join(directory, "feed.mjs");
  try {
    await build({
      entryPoints: [join(root, "src/EndlessEditorialFeed.jsx")],
      outfile: output,
      bundle: true,
      platform: "node",
      format: "esm",
      external: ["react"],
      loader: { ".css": "empty" },
      logLevel: "silent",
    });
    const { default: Feed } = await import(pathToFileURL(output));
    const html = renderToStaticMarkup(
      React.createElement(Feed, {
        feed: [{ type: "product", product: { id: "ME-001" } }],
        L: (_, english) => english,
        renderEntry: (entry) =>
          React.createElement(
            "button",
            { "data-product": entry.product.id },
            entry.product.id,
          ),
        renderPause: () => React.createElement("span", null, "Repeated feed"),
      }),
    );
    assert.equal((html.match(/data-product=/g) || []).length, 1);
    assert.match(html, /One piece matches your current filters/);
    assert.match(html, /You’ve seen the matching piece/);
    assert.doesNotMatch(html, /Keep browsing pieces|Repeated feed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
