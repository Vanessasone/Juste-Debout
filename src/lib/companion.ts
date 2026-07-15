/**
 * Flow — appel de l'assistant IA via l'Edge Function Supabase `companion`.
 * La clé API Claude n'est jamais dans l'app : elle vit côté serveur (secret Supabase).
 */
import { supabase } from '@/lib/supabase';

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export class CompanionError extends Error {}

/** Envoie l'historique à l'assistant et renvoie sa réponse (texte). */
export async function askCompanion(messages: ChatMsg[], context?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('companion', {
    body: { messages, context },
  });

  if (error) {
    throw new CompanionError(
      "L'assistant n'est pas joignable. Vérifie ta connexion (ou que la fonction est déployée).",
    );
  }
  if (data?.error) {
    if (data.error === 'not_configured') {
      throw new CompanionError(
        "L'assistant IA n'est pas encore activé : la clé API Claude doit être configurée côté serveur.",
      );
    }
    throw new CompanionError("L'assistant a rencontré un souci. Réessaie dans un instant.");
  }
  const text = (data?.text as string | undefined)?.trim();
  return text && text.length > 0 ? text : "Je n'ai pas de réponse pour le moment, reformule ?";
}
