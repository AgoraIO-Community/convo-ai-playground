interface ReleasableAgoraTrack {
  getMediaStreamTrack: () => { stop: () => void };
  stop: () => void;
  close: () => void;
}

export function releaseAgoraTrack(track: ReleasableAgoraTrack | null): void {
  if (!track) return;

  const cleanupSteps = [
    (): void => track.getMediaStreamTrack().stop(),
    (): void => track.stop(),
    (): void => track.close(),
  ];

  cleanupSteps.forEach((cleanup) => {
    try {
      cleanup();
    } catch {
      // Cleanup is deliberately best-effort so later resources are still released.
    }
  });
}
