import { useEffect, useRef } from "react";

function applyFill(fill: HTMLElement, scroller: HTMLElement) {
  const range = scroller.scrollHeight - scroller.clientHeight;
  const progress = range <= 0 ? 0 : Math.min(1, Math.max(0, scroller.scrollTop / range));
  fill.style.transform = `translateY(${(1 - progress) * 100}%)`;
}

/** Decorative pint that fills as `.content` scrolls. CSS scroll-driven when available. */
export function BeerScroll() {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (CSS.supports("animation-timeline", "scroll()")) return;
    const fill = fillRef.current;
    const scroller = fill?.closest(".main")?.querySelector<HTMLElement>(".content");
    if (!fill || !scroller) return;

    const onScroll = () => applyFill(fill, scroller);
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="beer-scroll" aria-hidden="true">
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
