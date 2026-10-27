import "server-only";

/**
 * Optional timings for local production diagnostics. Labels are static and the
 * helper never records SQL text, query values, identities, or returned data.
 */
export async function measureServerWork<T>(
  label: string,
  operation: () => T,
): Promise<Awaited<T>> {
  if (process.env.APP_PERF_LOGS !== "true") {
    return await operation();
  }

  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    const durationMs = (performance.now() - startedAt).toFixed(1);
    console.info(`[app-perf] op=${label} duration_ms=${durationMs}`);
  }
}
