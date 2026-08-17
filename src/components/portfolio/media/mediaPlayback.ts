export const PORTFOLIO_MEDIA_PLAY_EVENT = "rive:portfolio-media-play";

export function claimPortfolioPlayback(instanceId: string) {
  window.dispatchEvent(new CustomEvent(PORTFOLIO_MEDIA_PLAY_EVENT, { detail: { instanceId } }));
}

export function onOtherPortfolioPlayback(instanceId: string, stop: () => void) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ instanceId?: string }>).detail;
    if (detail?.instanceId !== instanceId) stop();
  };
  window.addEventListener(PORTFOLIO_MEDIA_PLAY_EVENT, listener);
  return () => window.removeEventListener(PORTFOLIO_MEDIA_PLAY_EVENT, listener);
}
