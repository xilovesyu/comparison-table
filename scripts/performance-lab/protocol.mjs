export const DEFAULT_PROTOCOL_TIMEOUT_MS = 30_000;

export function afterTwoAnimationFrames({
  token,
  currentToken,
  startedAt = performance.now(),
  timeoutMs = DEFAULT_PROTOCOL_TIMEOUT_MS,
  telemetry = {},
}) {
  return new Promise((resolve) => {
    const longtasks = [];
    let observer;
    if (telemetry.longtask && typeof PerformanceObserver !== 'undefined') {
      try {
        observer = new PerformanceObserver((list) => {
          longtasks.push(
            ...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration })),
          );
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch {
        // Optional longtask telemetry is unsupported in some browsers.
      }
    }
    const finish = (result) => {
      clearTimeout(timeout);
      observer?.disconnect();
      resolve({
        ...result,
        durationMs: performance.now() - startedAt,
        telemetry: {
          longtasks: telemetry.longtask ? longtasks : undefined,
          heap:
            telemetry.heap && performance.memory
              ? { usedJSHeapSize: performance.memory.usedJSHeapSize }
              : undefined,
        },
      });
    };
    const timeout = setTimeout(() => finish({ status: 'timeout', category: 'timeout' }), timeoutMs);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (currentToken() !== token) finish({ status: 'stale', category: 'stale' });
        else finish({ status: 'ok' });
      }),
    );
  });
}

export function protocolError(error) {
  return { status: 'error', category: 'error', error: String(error?.stack ?? error) };
}
