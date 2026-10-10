const publicPaths = new Set(['/', '/billetterie', '/ticket-details', '/ticket-success', '/ticket-cancel']);

export function ticketVisitBeforeSend(event: { type: string; url: string }): { type: 'pageview'; url: string } | null {
  if (event.type !== 'pageview') return null;
  try {
    const url = new URL(event.url);
    if (url.protocol !== 'https:' || !publicPaths.has(url.pathname)) return null;
    return { type: 'pageview', url: url.origin + url.pathname };
  } catch {
    return null;
  }
}
