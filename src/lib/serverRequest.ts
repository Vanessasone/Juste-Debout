/** A timeout is an uncertain result: never automatically retry a write. */
export async function serverRequest<T>(
  request: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs = 12000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('server_request_timeout'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => request(controller.signal)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
