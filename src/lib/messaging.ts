/**
 * Messagerie — conversations privées 1:1 + temps réel (Supabase Realtime).
 */
import { notifyConversation } from '@/lib/push';
import { supabase } from '@/lib/supabase';

export type ConversationSummary = {
  id: string;
  is_group: boolean;
  title: string | null;
  last_message: string | null;
  last_message_at: string | null;
  other_id: string | null;
  other_alias: string | null;
  other_name: string | null;
  other_photo: string | null;
  unread: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
};

/** Nom affichable d'une conversation (autre participant pour un 1:1). */
export function conversationName(cv: ConversationSummary, t: (k: string) => string): string {
  if (cv.is_group) return cv.title || t('msg.group');
  return cv.other_alias || cv.other_name || t('profile.dancer');
}

/** Mes conversations, enrichies (autre participant + non-lus), les plus récentes d'abord. */
export async function getConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase.rpc('my_conversations');
  if (error) throw error;
  return (data ?? []) as ConversationSummary[];
}

/** Nombre total de messages non lus (pour la pastille de la messagerie). */
export async function getUnreadTotal(): Promise<number> {
  const list = await getConversations();
  return list.reduce((s, c) => s + (c.unread || 0), 0);
}

/** Ouvre (ou crée) la conversation 1:1 avec un danseur ; renvoie son id. */
export async function startDM(otherId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_dm', { p_other: otherId });
  if (error) throw error;
  return data as string;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(conversationId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, body: text });
  if (error) throw error;
  // Notifie l'autre participant (best-effort, ne bloque pas).
  void notifyConversation(conversationId, text);
}

/** Marque la conversation comme lue (met à jour last_read_at). */
export async function markRead(conversationId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('profile_id', user.id);
}

/** Abonnement temps réel aux nouveaux messages d'une conversation. Renvoie une fonction de nettoyage. */
export function subscribeMessages(conversationId: string, onInsert: (m: Message) => void): () => void {
  const channel = supabase
    .channel(`msg:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as Message),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
