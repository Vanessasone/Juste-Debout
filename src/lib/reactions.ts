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

/** Un cadeau diffusé en direct : emoji + nom + pseudo de l'envoyeur + côté visé. */
export type GiftBlast = { emoji: string; name: string; who: string; side: 'a' | 'b' };

/** Canal de diffusion des cadeaux (éphémère, comme les réactions). */
export function openGiftBroadcast(channelKey: string, onGift: (g: GiftBlast) => void) {
  const channel = supabase.channel(`gift:${channelKey}`, { config: { broadcast: { self: false } } });
  channel
    .on('broadcast', { event: 'g' }, (msg: { payload?: { emoji?: string; name?: string; who?: string; side?: 'a' | 'b' } }) => {
      const g = msg?.payload;
      if (g?.emoji) onGift({ emoji: g.emoji, name: g.name ?? '', who: g.who ?? '', side: g.side ?? 'a' });
    })
    .subscribe();
  return {
    send(g: GiftBlast) {
      channel.send({ type: 'broadcast', event: 'g', payload: g });
    },
    close() {
      supabase.removeChannel(channel);
    },
  };
}
