import { useEffect, useState, type RefObject } from "react";

/** True while the element is wider inside than outside, i.e. it scrolls sideways. Used to make exactly those boxes keyboard-reachable. */
export function useScrolls(ref: RefObject<HTMLElement | null>): boolean {
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = (): void => setScrolls(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [ref]);
  return scrolls;
}
