/**
 * Gestion du compte — suppression définitive (RGPD + exigence App Store).
 */
import { supabase } from '@/lib/supabase';

export class AccountError extends Error {}

/** Supprime définitivement le compte de l'utilisateur courant, puis déconnecte. */
export async function deleteMyAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) {
    throw new AccountError(
      "La suppression n'a pas pu aboutir. Vérifie ta connexion (ou que la fonction est déployée).",
    );
  }
  if (data?.error) {
    if (data.error === 'not_configured') {
      throw new AccountError("La suppression de compte n'est pas encore activée côté serveur.");
    }
    throw new AccountError("La suppression a échoué. Réessaie ou contacte le support.");
  }
  // Nettoie la session locale.
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
}
