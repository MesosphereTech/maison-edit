// Process-local safeguards for the single-instance, public review deployment.
// Counters reset with the process; this is not durable quota or a billing cap.
export function createPublicReviewLimits(env = {}, now = Date.now) {
  const enabled = env.PUBLIC_REVIEW_MODE === 'true';
  const integer = (name, fallback, max) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > max)
      throw new Error(`Invalid ${name} public review setting.`);
    return value;
  };
  const limits = enabled ? {
    perMinute: integer('PUBLIC_REVIEW_REQUESTS_PER_MINUTE', 12, 60),
    perDay: integer('PUBLIC_REVIEW_REQUESTS_PER_DAY', 200, 1000),
    concurrent: integer('PUBLIC_REVIEW_MAX_CONCURRENT', 2, 4),
  } : null;
  let minute = -1, minuteCount = 0, day = -1, dayCount = 0, active = 0;
  return {
    metadata() {
      return enabled ? { publicReview: true, reviewLimits: { ...limits, scope: 'single_process', durable: false } } : {};
    },
    acquire() {
      if (!enabled) return { allowed: true, release() {} };
      const time = now();
      const dayOffset = 8 * 60 * 60 * 1000; // Review day resets at midnight in Asia/Shanghai.
      const nextMinute = Math.floor(time / 60000), nextDay = Math.floor((time + dayOffset) / 86400000);
      if (nextMinute !== minute) { minute = nextMinute; minuteCount = 0; }
      if (nextDay !== day) { day = nextDay; dayCount = 0; }
      const reject = (code, retryAfterSeconds) => ({ allowed: false, code, retryAfterSeconds });
      if (dayCount >= limits.perDay) return reject('review_daily_limit', Math.max(1, Math.ceil(((day + 1) * 86400000 - dayOffset - time) / 1000)));
      if (minuteCount >= limits.perMinute) return reject('review_rate_limited', Math.max(1, Math.ceil(((minute + 1) * 60000 - time) / 1000)));
      if (active >= limits.concurrent) return reject('review_busy', 5);
      minuteCount++; dayCount++; active++;
      let released = false;
      return { allowed: true, release() { if (!released) { released = true; active--; } } };
    },
  };
}
