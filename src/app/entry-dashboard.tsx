import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { Space } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

const EVENT = 'eb0025ca-b597-4708-9d47-b24ebbf507b5';
const EVENT_START = '2027-03-13';
const EVENT_END = '2027-03-14';
type Summary = { ok: boolean; entries: number; remaining: number; capacity: number; error?: string };
type Details = { ok: boolean; by_hour?: Array<{h:number;entries:number}>; by_category?: Array<{category:string;entries:number}>; error?: string };

export default function EntryDashboard() {
  const c = useColors();
  const [data, setData] = useState<Summary | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [err, setErr] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const today = new Date(clock).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
  const eventDay = today >= EVENT_START && today <= EVENT_END;
  const stale = updatedAt === null || clock - updatedAt > 15000;

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
      const [a, b] = await Promise.all([
        supabase.rpc('entry_dashboard', { p_event: EVENT, p_date: date }),
        supabase.rpc('entry_dashboard_details', { p_event: EVENT, p_date: date }),
      ]);
      if (!mounted.current) return;
      if (a.error || !a.data?.ok || b.error || !b.data?.ok) {
        setErr(a.error?.message || a.data?.error || b.error?.message || b.data?.error || 'Synchronisation impossible');
        return;
      }
      setData(a.data as Summary);
      setDetails(b.data as Details);
      setUpdatedAt(Date.now());
      setErr('');
    } catch {
      if (mounted.current) setErr('Connexion au serveur indisponible');
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const refresh = setInterval(() => { void load(); }, 5000);
    const tick = setInterval(() => setClock(Date.now()), 1000);
    return () => { mounted.current = false; clearInterval(refresh); clearInterval(tick); };
  }, [load]);

  return <Screen>
    <PageHeader title="Contrôle des entrées" subtitle="Juste Debout · supervision" />
    <Card style={{ marginBottom: Space.md }}>
      <T variant="h3" color={err || stale ? c.danger : c.primary}>
        {err || stale ? '● SYNCHRONISATION INDISPONIBLE' : '● DONNÉES ACTUALISÉES'}
      </T>
      <T variant="small" color={c.textDim} style={{ marginTop: 7 }}>
        {updatedAt ? `Dernière actualisation : ${new Date(updatedAt).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'En attente de la première synchronisation'}
      </T>
      {(err || stale) && <T variant="small" color={c.danger} style={{ marginTop: 8 }}>
        {err || 'Les chiffres sont anciens : ne pas les utiliser pour décider des admissions.'}
      </T>}
      <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.refresh}>
        <T variant="label" color="#101010">ACTUALISER MAINTENANT</T>
      </Pressable>
    </Card>
    {!eventDay && <Card style={{ marginBottom: Space.md }}>
      <T variant="h3">Événement à venir</T>
      <T variant="small" color={c.textDim} style={{ marginTop: 6 }}>
        Les finales ont lieu les 13 et 14 mars 2027. Les compteurs ci-dessous concernent la date du jour et non les ventes ou réservations.
      </T>
    </Card>}
    {!data ? <ActivityIndicator color={c.primary} /> : <>
      <View style={styles.grid}>
        <Metric n={data.entries} label="ENTRÉES" />
        <Metric n={data.remaining} label="RESTANTES" />
        <Metric n={data.capacity} label="CAPACITÉ" />
      </View>
      <Card>
        <T variant="h3">État du contrôle</T>
        <T variant="small" color={c.textDim} style={{ marginTop: 8 }}>Actualisation toutes les 5 secondes, si le serveur répond.</T>
        <T variant="small" color={c.textDim} style={{ marginTop: 4 }}>Toute sortie est définitive pour la journée. Un billet déjà scanné est refusé à une nouvelle tentative.</T>
      </Card>
      {details && <>
        <Card style={{ marginTop: Space.lg }}>
          <T variant="h3">Entrées par heure</T>
          {details.by_hour?.length ? details.by_hour.map(x =>
            <T key={x.h} variant="small" color={c.textDim} style={{ marginTop: 6 }}>{String(x.h).padStart(2, '0')}h · {x.entries} entrée(s)</T>
          ) : <T variant="small" color={c.textMute} style={{ marginTop: 6 }}>Aucune entrée pour le moment.</T>}
        </Card>
        <Card style={{ marginTop: Space.md }}>
          <T variant="h3">Entrées par catégorie</T>
          {details.by_category?.length ? details.by_category.map(x =>
            <T key={x.category} variant="small" color={c.textDim} style={{ marginTop: 6 }}>{x.category} · {x.entries}</T>
          ) : <T variant="small" color={c.textMute} style={{ marginTop: 6 }}>Aucune entrée pour le moment.</T>}
        </Card>
      </>}
    </>}
  </Screen>;
}
function Metric({ n, label }: { n: number; label: string }) {
  return <Card style={{ flex: 1, alignItems: 'center' }}><T variant="title">{n}</T><T variant="caption">{label}</T></Card>;
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 8, marginBottom: Space.lg },
  refresh: { backgroundColor: '#B5FA42', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', marginTop: 14 },
});
