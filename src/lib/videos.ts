/**
 * Replay — vidéos YouTube de la chaîne Juste Debout.
 */
import { supabase } from '@/lib/supabase';

export type Video = {
  id: string;
  youtube_id: string;
  title: string;
  discipline: string | null;
  year: number | null;
};

export async function getVideos(): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('id,youtube_id,title,discipline,year,sort_order,created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Video[];
}

/** Extrait l'identifiant (11 car.) d'un lien YouTube (watch, youtu.be, shorts, embed) ou d'un id brut. */
export function parseYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|watch\?v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  const t = url.trim();
  return /^[A-Za-z0-9_-]{11}$/.test(t) ? t : null;
}

export function youtubeThumb(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Ajouter une vidéo (admin) à partir d'un lien YouTube. */
export async function addVideo(input: {
  url: string;
  title: string;
  discipline?: string | null;
  year?: number | null;
}): Promise<void> {
  const yid = parseYoutubeId(input.url);
  if (!yid) throw new Error('Lien YouTube invalide.');
  const { error } = await supabase.from('videos').insert({
    youtube_id: yid,
    title: input.title.trim(),
    discipline: input.discipline ?? null,
    year: input.year ?? null,
  });
  if (error) throw error;
}
