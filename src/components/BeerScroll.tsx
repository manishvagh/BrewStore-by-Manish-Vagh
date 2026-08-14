import { useEffect, useRef } from "react";

function fillProgress(scroller: HTMLElement) {
  const range = scroller.scrollHeight - scroller.clientHeight;
  if (range <= 1) return 0;
  const raw = scroller.scrollTop / range;
  // Virtual grids can shrink scrollHeight at the last row; treat the last
  // couple of pixels as a full pour so the pint does not snap empty.
  if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
    return 1;
  }
  return Math.min(1, Math.max(0, raw));
}

/** Decorative pint that fills as `.content` scrolls. */
export function BeerScroll() {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fill = fillRef.current;
    const scroller = fill?.closest(".main")?.querySelector<HTMLElement>(".content");
    if (!fill || !scroller) return;

    let frame = 0;
    const apply = () => {
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
