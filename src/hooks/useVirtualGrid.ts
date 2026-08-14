import { useLayoutEffect, useRef, useState } from "react";

const OVERSCAN_ROWS = 4;
const DEFAULT_ROW = 136;
const DEFAULT_COL_MIN = 280;
const INITIAL_END = 48;

function scrollParentOf(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") return el;
    el = el.parentElement;
  }
  return null;
}

function parsePxOrRem(value: string, fallback: number) {
  const raw = value.trim();
  if (!raw) return fallback;
  if (raw.endsWith("rem")) {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return parseFloat(raw) * root || fallback;
  }
  return parseFloat(raw) || fallback;
}

function gridMetrics(el: HTMLElement) {
  const styles = getComputedStyle(el);
  const gap = parseFloat(styles.rowGap || styles.columnGap || styles.gap) || 14;
  const colMin = parsePxOrRem(
    styles.getPropertyValue("--pkg-col-min"),
    DEFAULT_COL_MIN,
  );
  const rowHeight = parsePxOrRem(
    styles.getPropertyValue("--pkg-row-height"),
    DEFAULT_ROW,
  );
  const columns = Math.max(1, Math.floor((el.clientWidth + gap) / (colMin + gap)));
  return { gap, columns, rowHeight };
}

export function useVirtualGrid(itemCount: number, resetKey?: string | number) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({
    start: 0,
    end: Math.min(itemCount, INITIAL_END),
  });
  const [pad, setPad] = useState({ top: 0, bottom: 0 });

  useLayoutEffect(() => {
    setRange({ start: 0, end: Math.min(itemCount, INITIAL_END) });
    setPad({ top: 0, bottom: 0 });
  }, [itemCount, resetKey]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const grid = gridRef.current;
    const scroller = scrollParentOf(wrap);
    if (!wrap || !grid || !scroller || itemCount === 0) return;

    const root = scroller;
    let frame = 0;

    function update() {
      const currentGrid = gridRef.current;
      const currentWrap = wrapRef.current;
      if (!currentGrid || !currentWrap) return;
      if (currentGrid.clientWidth < 40) return;

      const { gap, columns, rowHeight } = gridMetrics(currentGrid);
      const stride = rowHeight + gap;
      const rows = Math.max(1, Math.ceil(itemCount / columns));
      const totalHeight = rows * stride - gap;

      const wrapTop =
        currentWrap.getBoundingClientRect().top -
        root.getBoundingClientRect().top +
        root.scrollTop;
      const localY = Math.max(0, root.scrollTop - wrapTop);
      const startRow = Math.max(
        0,
        Math.min(rows - 1, Math.floor(localY / stride) - OVERSCAN_ROWS),
      );
      const visibleRows =
        Math.ceil(root.clientHeight / stride) + OVERSCAN_ROWS * 2;
      const endRow = Math.min(rows, startRow + Math.max(visibleRows, 6));
      const start = startRow * columns;
      const end = Math.min(itemCount, endRow * columns);
      const top = startRow * stride;
      const bottom = Math.max(0, totalHeight - endRow * stride + gap);

      setRange((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
      );
      setPad((prev) =>
        prev.top === top && prev.bottom === bottom ? prev : { top, bottom },
      );
    }

    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    }

    const resize = new ResizeObserver(onScroll);
    resize.observe(grid);
    resize.observe(root);
    root.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      root.removeEventListener("scroll", onScroll);
    };
  }, [itemCount, resetKey]);

  return { wrapRef, gridRef, start: range.start, end: range.end, pad };
}
