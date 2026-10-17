import test from "node:test";
import assert from "node:assert/strict";
import { createPublicReviewLimits } from "../server/public-review-limits.mjs";
import { createAppServer } from "../server/index.mjs";

test("private mode preserves existing behavior without public quotas", () => {
  const guard = createPublicReviewLimits({
    PUBLIC_REVIEW_REQUESTS_PER_DAY: "invalid",
  });
  assert.deepEqual(guard.metadata(), {});
  for (let i = 0; i < 250; i++) assert.equal(guard.acquire().allowed, true);
});
test("public minute limit is global, recovers next minute and retains daily usage", () => {
  let now = 0;
  const guard = createPublicReviewLimits(
    {
      PUBLIC_REVIEW_MODE: "true",
      PUBLIC_REVIEW_REQUESTS_PER_MINUTE: "2",
      PUBLIC_REVIEW_REQUESTS_PER_DAY: "3",
    },
    () => now,
  );
  for (let i = 0; i < 2; i++) guard.acquire().release();
  assert.deepEqual(guard.acquire(), {
    allowed: false,
    code: "review_rate_limited",
    retryAfterSeconds: 60,
  });
  now = 60000;
  guard.acquire().release();
  assert.equal(guard.acquire().code, "review_daily_limit");
  now = 16 * 60 * 60 * 1000; // Midnight Asia/Shanghai begins a new review day.
  assert.equal(guard.acquire().allowed, true);
});
test("concurrency release is idempotent and rejects do not reserve capacity", () => {
  const guard = createPublicReviewLimits({ PUBLIC_REVIEW_MODE: "true" });
  const a = guard.acquire(),
    b = guard.acquire();
  assert.equal(guard.acquire().code, "review_busy");
  a.release();
  a.release();
  const c = guard.acquire();
  assert.equal(c.allowed, true);
  assert.equal(guard.acquire().code, "review_busy");
  b.release();
  c.release();
});
test("invalid enabled settings fail closed; metadata states non-durable scope", () => {
  for (const value of ["0", "-1", "Infinity", "1.5", "invalid", "1001"])
    assert.throws(() =>
      createPublicReviewLimits({
        PUBLIC_REVIEW_MODE: "true",
        PUBLIC_REVIEW_REQUESTS_PER_DAY: value,
      }),
    );
  assert.deepEqual(
    createPublicReviewLimits({ PUBLIC_REVIEW_MODE: "true" }).metadata(),
    {
      publicReview: true,
      reviewLimits: {
        perMinute: 12,
        perDay: 200,
        concurrent: 2,
        scope: "single_process",
        durable: false,
      },
    },
  );
});
test("public HTTP daily limit prevents another provider call and permits browsing/status", async (t) => {
  let calls = 0;
  const server = createAppServer({
    env: {
      GEMINI_API_KEY: "mock-review-test-only",
      GEMINI_MODEL: "gemini-test-model",
      PUBLIC_REVIEW_MODE: "true",
      PUBLIC_REVIEW_REQUESTS_PER_DAY: "1",
    },
    fetchImpl: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      reply: "A soft layer balances a tailored silhouette.",
                      recommendations: [
                        {
                          productId: "ME-001",
                          reason: "A sculpted shape with warm colour.",
                        },
                      ],
                    }),
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        }),
      );
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: "A quiet gallery outfit",
      language: "en",
      consent: { googleAI: true },
    }),
  };
  const first = await fetch(base + "/api/guide", request);
  assert.equal((await first.json()).mode, "gemini");
  const limited = await fetch(base + "/api/guide", request);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).code, "review_daily_limit");
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.equal(calls, 1);
  const status = await (await fetch(base + "/api/status")).json();
  assert.equal(status.publicReview, true);
  assert.equal(JSON.stringify(status).includes("mock-review-test-only"), false);
});
