import { useEffect, useRef, type RefObject } from "react";

function fillProgress(scroller: HTMLElement) {
  const range = scroller.scrollHeight - scroller.clientHeight;
  if (range <= 1) return 0;
  const raw = scroller.scrollTop / range;
  if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
    return 1;
  }
  return Math.min(1, Math.max(0, raw));
}

interface Props {
  /** Defaults to the main `.content` pane when omitted. */
  scrollerRef?: RefObject<HTMLElement | null>;
}

/** Decorative pint that fills as a scroller moves. */
export function BeerScroll({ scrollerRef }: Props) {
  const fillRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fill = fillRef.current;
    const root = rootRef.current;
    const scroller =
      scrollerRef?.current ??
      fill?.closest(".main")?.querySelector<HTMLElement>(".content");
    if (!fill || !root || !scroller) return;

    let frame = 0;
    const apply = () => {
      const range = scroller.scrollHeight - scroller.clientHeight;
      root.classList.toggle("is-idle", range <= 1);
      fill.style.transform = `translateY(${(1 - fillProgress(scroller)) * 100}%)`;
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };

    apply();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(scroller);
    for (const child of scroller.children) {
      if (child instanceof HTMLElement) ro.observe(child);
    }
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [scrollerRef]);

  return (
    <div className="beer-scroll" ref={rootRef} aria-hidden="true">
      <div className="beer-glass">
        <div className="beer-fill" ref={fillRef}>
          <span className="beer-foam" />
          <span className="beer-bubble b1" />
          <span className="beer-bubble b2" />
          <span className="beer-bubble b3" />
        </div>
      </div>
    </div>
  );
}
