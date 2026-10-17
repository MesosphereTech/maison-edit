import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  endlessFeedPage,
  feedPageOffsets,
  feedPageWindow,
} from "./endless-feed.js";
import "./endless-feed.css";
import {
  JOURNEY_REQUEST_EVENT,
  JOURNEY_READY_EVENT,
  JOURNEY_RELEASE_EVENT,
  nextFeedPausePosition,
} from "./guided-journey.js";
import { FEED_PAGE_SIZE } from "./endless-feed.js";

function MeasuredPage({ number, onMeasure, children }) {
  const element = useRef(null);
  useLayoutEffect(() => {
    const measure = () =>
      onMeasure(number, element.current.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [number, onMeasure]);
  return (
    <div
      className="endless-feed-page editorial-grid"
      data-feed-page={number}
      ref={element}
    >
      {children}
    </div>
  );
}

// Only the nearby pages own cards. Measured spacers preserve the document's
// geometry, and scrolling back restores the same occurrences and SKU state.
export default function EndlessEditorialFeed({
  feed,
  renderEntry,
  renderPause,
  L,
}) {
  const singleProduct = feed.filter((entry) => entry.type === "product");
  const singleFiltered =
    singleProduct.length > 0 &&
    new Set(singleProduct.map((entry) => entry.product.id)).size === 1;
  const root = useRef(null);
  const sentinel = useRef(null);
  const heights = useRef(new Map());
  const [pageCount, setPageCount] = useState(1);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [measurement, setMeasurement] = useState(0);
  const [pinnedPage, setPinnedPage] = useState(null);
  const [journeyPause, setJourneyPause] = useState(null);
  const journeyPauseRef = useRef(null);
  const pendingContinue = useRef(null);
  const offsets = useMemo(
    () => feedPageOffsets(pageCount, heights.current),
    [pageCount, measurement],
  );
  const live = useRef({ offsets, range, pageCount });
  live.current = { offsets, range, pageCount };
  const measure = useCallback((page, height) => {
    if (height <= 0 || Math.abs((heights.current.get(page) || 0) - height) < 1)
      return;
    heights.current.set(page, height);
    setMeasurement((n) => n + 1);
  }, []);
  const scan = useCallback(() => {
    if (!root.current) return;
    const top = -root.current.getBoundingClientRect().top;
    const next = feedPageWindow(live.current.offsets, top, window.innerHeight);
    // Never evict a keyboard user's focused controls while they are using them.
    const focused = document.activeElement?.closest("[data-feed-page]");
    if (focused && root.current.contains(focused)) {
      const page = Number(focused.dataset.feedPage);
      setPinnedPage(page < next.start || page > next.end ? page : null);
    } else setPinnedPage(null);
    setRange((old) =>
      old.start === next.start && old.end === next.end ? old : next,
    );
  }, []);
  useEffect(() => {
    let frame;
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = null;
          scan();
        });
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [scan]);
  const append = useCallback(() => {
    if (journeyPauseRef.current) return;
    const count = live.current.pageCount;
    // Synchronize the ref too, so duplicate observer deliveries cannot append
    // twice before React commits a page.
    live.current.pageCount = count + 1;
    setPageCount(count + 1);
    setRange({ start: Math.max(0, count - 2), end: count });
  }, []);
  useEffect(() => {
    if (!sentinel.current || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) append();
      },
      { rootMargin: "350px 0px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [append, pageCount]);
  const revealNext = useCallback((position) => {
    const next = [...root.current.querySelectorAll("[data-feed-position]")]
      .filter((element) => Number(element.dataset.feedPosition) > position)
      .sort(
        (a, b) =>
          Number(a.dataset.feedPosition) - Number(b.dataset.feedPosition),
      )[0];
    if (!next) return false;
    const top = next.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({
      top,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    return true;
  }, []);
  useLayoutEffect(() => {
    if (pendingContinue.current !== null && revealNext(pendingContinue.current))
      pendingContinue.current = null;
  }, [pageCount, range, revealNext]);
  const continueAfter = (position) => {
    if (revealNext(position)) return;
    pendingContinue.current = position;
    append();
  };
  // Materialize the next real editorial pause without inventing a second CTA.
  // Its page stays mounted during travel, so virtualization cannot remove the
  // action from under a keyboard user or move it indefinitely into the future.
  useEffect(() => {
    const request = (event) => {
      const position = nextFeedPausePosition(
        feed.length,
        event.detail?.afterPosition,
      );
      if (position === null || singleFiltered) return;
      const pause = {
        ...event.detail,
        position,
        page: Math.floor(position / FEED_PAGE_SIZE),
      };
      journeyPauseRef.current = pause;
      setJourneyPause(pause);
      setPageCount((count) => Math.max(count, pause.page + 1));
    };
    const release = () => {
      journeyPauseRef.current = null;
      setJourneyPause(null);
    };
    window.addEventListener(JOURNEY_REQUEST_EVENT, request);
    window.addEventListener(JOURNEY_RELEASE_EVENT, release);
    return () => {
      window.removeEventListener(JOURNEY_REQUEST_EVENT, request);
      window.removeEventListener(JOURNEY_RELEASE_EVENT, release);
    };
  }, [feed.length, singleFiltered]);
  useLayoutEffect(() => {
    if (!journeyPause) return;
    const target = root.current?.querySelector(
      `[data-feed-position="${journeyPause.position}"] [data-tour-action="plan-visit"]`,
    );
    if (target)
      window.dispatchEvent(
        new CustomEvent(JOURNEY_READY_EVENT, {
          detail: { ...journeyPause, target },
        }),
      );
  }, [journeyPause, pageCount]);
  const activePages = new Set();
  for (
    let number = range.start;
    number <= Math.min(range.end, pageCount - 1);
    number++
  )
    activePages.add(number);
  if (pinnedPage !== null) activePages.add(pinnedPage);
  if (journeyPause) activePages.add(journeyPause.page);
  const pages = [];
  let previousEnd = 0;
  for (const number of [...activePages].sort((a, b) => a - b)) {
    if (offsets[number] > previousEnd)
      pages.push(
        <div
          key={`gap-${number}`}
          className="feed-window-spacer"
          style={{ height: offsets[number] - previousEnd }}
          aria-hidden="true"
        />,
      );
    pages.push(
      <MeasuredPage key={number} number={number} onMeasure={measure}>
        {endlessFeedPage(feed, number).map((entry) => (
          <React.Fragment key={entry.occurrenceId}>
            {entry.type === "pause"
              ? renderPause(entry, () => continueAfter(entry.position))
              : renderEntry(entry)}
          </React.Fragment>
        ))}
      </MeasuredPage>,
    );
    previousEnd = offsets[number + 1];
  }
  // A one-result search is a finite result, not a reason to fill adjacent
  // columns with the same SKU. Wider catalogues keep their existing feed.
  if (singleFiltered)
    return (
      <div
        className="endless-feed is-single-result"
        ref={root}
        data-feed-pages="1"
      >
        <p className="feed-repeat-note">
          {L(
            "当前筛选找到 1 款单品。",
            "One piece matches your current filters.",
          )}
        </p>
        <div className="endless-feed-page editorial-grid" data-feed-page="0">
          {renderEntry({
            ...singleProduct[0],
            occurrenceId: "feed-0",
            position: 0,
            cycle: 0,
          })}
        </div>
        <div className="feed-end" role="status">
          {L(
            "已展示全部匹配单品。调整搜索或分类，可继续发现更多。",
            "You’ve seen the matching piece. Change your search or department to discover more.",
          )}
        </div>
      </div>
    );
  return (
    <div className="endless-feed" ref={root} data-feed-pages={pageCount}>
      <p className="feed-repeat-note">
        {L(
          "浏览会循环呈现当前筛选内的虚构目录，换个顺序，再看看喜欢的。",
          "Keep browsing the same fictional catalog, thoughtfully reordered within your filters.",
        )}
      </p>
      {pages}
      <div
        className="feed-window-spacer"
        style={{ height: Math.max(0, offsets[pageCount] - previousEnd) }}
        aria-hidden="true"
      />
      <div className="feed-end" ref={sentinel}>
        <button className="line-link" onClick={append}>
          {L("继续浏览商品", "Keep browsing pieces")}{" "}
          <span aria-hidden="true">→</span>
        </button>
        <span className="feed-load-status" role="status" aria-live="polite">
          {L("已展开", "Opened")} {pageCount} {L("页", "pages")}
        </span>
      </div>
    </div>
  );
}
