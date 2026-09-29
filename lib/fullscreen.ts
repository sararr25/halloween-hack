// True full screen (no tabs, no address bar): the Fullscreen API. Browsers only allow it
// from a user gesture, and Esc always leaves it, so the page offers a way back in.

export function isFullscreen() {
  return typeof document !== "undefined" && document.fullscreenElement !== null;
}

export function onFullscreenChange(fn: () => void) {
  document.addEventListener("fullscreenchange", fn);
  return () => document.removeEventListener("fullscreenchange", fn);
}

/** Call from a click. Refusal (browser setting, iframe) is reported, the experience goes on. */
export function enterFullscreen() {
  if (isFullscreen() || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch((e: unknown) => {
    console.warn("full screen refused by the browser:", e);
  });
}

export function exitFullscreen() {
  if (isFullscreen()) void document.exitFullscreen();
}
