/**
 * Réactions LIVE — via le BROADCAST temps réel de Supabase (messages éphémères,
 * ZÉRO écriture en base) → tient des centaines de milliers de viewers sans coût DB.
 * onReact reçoit les réactions des AUTRES spectateurs ; send() diffuse la tienne à tous.
 */
import { supabase } from '@/lib/supabase';

export const REACTIONS = ['🔥', '👏', '💯', '🙌', '❤️'] as const;
export type ReactionKind = (typeof REACTIONS)[number];

export function openReactions(channelKey: string, onReact: (kind: string) => void) {
  const channel = supabase.channel(`react:${channelKey}`, { config: { broadcast: { self: false } } });
  channel
    .on('broadcast', { event: 'r' }, (msg: { payload?: { k?: string } }) => {
      const k = msg?.payload?.k;
      if (k) onReact(k);
    })
    .subscribe();
  return {
    send(kind: string) {
      channel.send({ type: 'broadcast', event: 'r', payload: { k: kind } });
    },
    close() {
      supabase.removeChannel(channel);
    },
  };
}
