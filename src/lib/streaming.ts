/**
 * Live streaming — diffusion in-app via Bunny Stream (ingest RTMP externe → HLS).
 * L'app lit l'URL HLS ; le passage en direct est piloté par le staff.
 */
import { supabase } from '@/lib/supabase';

export type LiveStream = {
  id: string;
  event_id: string | null;
  title: string;
  provider: string;
  playback_url: string | null;
  status: 'idle' | 'live' | 'ended';
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

/** Le direct actuellement en cours (ou null). */
export async function getActiveLive(): Promise<LiveStream | null> {
  const { data, error } = await supabase.rpc('active_live');
  if (error) throw error;
  const rows = (data ?? []) as LiveStream[];
  return rows[0] ?? null;
}

/** Tous les directs (console admin), les plus récents d'abord. */
export async function getStreams(): Promise<LiveStream[]> {
  const { data, error } = await supabase
    .from('live_streams')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as LiveStream[];
}

/** Crée un direct (staff). */
export async function createStream(input: { title: string; playback_url?: string | null; event_id?: string | null }): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté.');
  const { data, error } = await supabase
    .from('live_streams')
    .insert({
      title: input.title.trim() || 'Direct Juste Debout',
      playback_url: input.playback_url?.trim() || null,
      event_id: input.event_id ?? null,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Met à jour l'URL HLS de lecture (staff). */
export async function setPlaybackUrl(id: string, url: string): Promise<void> {
  const { error } = await supabase.from('live_streams').update({ playback_url: url.trim() || null }).eq('id', id);
  if (error) throw error;
}

/** Passe le direct à l'antenne (staff). */
export async function goLive(id: string): Promise<void> {
  const { error } = await supabase
    .from('live_streams')
    .update({ status: 'live', started_at: new Date().toISOString(), ended_at: null })
    .eq('id', id);
  if (error) throw error;
}

/** Termine le direct (staff). */
export async function endLive(id: string): Promise<void> {
  const { error } = await supabase
    .from('live_streams')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Abonnement temps réel aux changements de direct (passage à l'antenne / fin). */
export function subscribeLive(onChange: () => void): () => void {
  const channel = supabase
    .channel('live_streams')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => onChange())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
