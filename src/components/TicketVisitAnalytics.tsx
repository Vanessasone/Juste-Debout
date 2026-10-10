import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ticketVisitBeforeSend } from '@/lib/ticketVisitPrivacy';

// Analytics is optional: a disabled service must never interfere with checkout.
export function TicketVisitAnalytics() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    void (async () => {
      try {
        const response = await fetch('/_vercel/insights/script.js', { method: 'HEAD', signal: controller.signal });
        if (!response.ok || !/javascript/i.test(response.headers.get('content-type') || '') || cancelled) return;
        const { inject } = await import('@vercel/analytics');
        if (!cancelled) inject({ mode: 'production', debug: false, scriptSrc: '/_vercel/insights/script.js', beforeSend: ticketVisitBeforeSend });
      } catch {
        // Visits remain unavailable until Analytics is enabled on the project.
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, []);
  return null;
}
