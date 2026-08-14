import { useLayoutEffect, useRef, useState } from "react";

const OVERSCAN_ROWS = 4;
const DEFAULT_ROW = 132;
const DEFAULT_COL_MIN = 280;

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
  const columns = Math.max(1, Math.floor((el.clientWidth + gap) / (colMin + gap)));
  return { gap, columns };
}

export function useVirtualGrid(itemCount: number, resetKey?: string | number) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: Math.min(itemCount, 36) });
  const [pad, setPad] = useState({ top: 0, bottom: 0 });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const grid = gridRef.current;
    const scroller = scrollParentOf(wrap);
    if (!wrap || !grid || !scroller || itemCount === 0) return;

    const root = scroller;
    root.scrollTop = 0;

    let rowHeight = DEFAULT_ROW;
    let frame = 0;

    function measureRow() {
      const first = gridRef.current?.firstElementChild as HTMLElement | undefined;
      if (first) rowHeight = Math.max(96, first.offsetHeight);
    }

    function update() {
      const currentGrid = gridRef.current;
      const currentWrap = wrapRef.current;
      if (!currentGrid || !currentWrap) return;
      if (currentGrid.clientWidth < 40) return;

      measureRow();
      const { gap, columns } = gridMetrics(currentGrid);
      const stride = rowHeight + gap;
      const rows = Math.max(1, Math.ceil(itemCount / columns));

      const wrapTop =
        currentWrap.getBoundingClientRect().top -
        root.getBoundingClientRect().top +
        root.scrollTop;
      const localY = root.scrollTop - wrapTop;
      const startRow = Math.max(
        0,
        Math.min(rows - 1, Math.floor(localY / stride) - OVERSCAN_ROWS),
      );
      const visibleRows = Math.ceil(root.clientHeight / stride) + OVERSCAN_ROWS * 2;
      const endRow = Math.min(rows, startRow + Math.max(visibleRows, 1));
      const start = startRow * columns;
      const end = Math.min(itemCount, endRow * columns);

      const top = startRow * stride;
      const bottom = Math.max(0, (rows - endRow) * stride);
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
      setPad((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
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
