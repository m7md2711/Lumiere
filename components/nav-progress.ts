/**
 * A tiny store counting navigations in flight. A counter rather than a boolean
 * because two links can be pending at once — a fast double tap, or a prefetch
 * landing mid-click — and the bar must not disappear while one is still going.
 */
let inFlight = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function startNav(): void {
  inFlight += 1;
  emit();
}

export function endNav(): void {
  inFlight = Math.max(0, inFlight - 1);
  emit();
}

export function navSnapshot(): boolean {
  return inFlight > 0;
}

export function subscribeNav(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
