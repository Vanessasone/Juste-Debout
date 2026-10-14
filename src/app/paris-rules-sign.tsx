import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Image, Pressable, Share, TextInput, View } from 'react-native';
import { Card, PageHeader, Screen, T } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { PARIS_RULES_TEXT, PARIS_RULES_VERSION } from '@/lib/rules/paris2027';
import { previewRegistrationPhoto, signParisRules } from '@/lib/parisRegistration';
import type { TourEntry } from '@/lib/tourRegistration';

export default function ParisRulesSign() {
  const c = useColors();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const [entry, setEntry] = useState<TourEntry | null>(null);
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!draftId) throw new Error('Lien de dossier manquant.');
        const { data, error: e } = await supabase.from('tour_registration_drafts').select('payload').eq('id', draftId).eq('stop_slug', 'paris').maybeSingle();
        if (e || !data) throw new Error('Connecte-toi avec l’e-mail du participant ou du responsable légal indiqué dans ce dossier.');
        if (!active) return;
        setEntry(data.payload as TourEntry);
        const paths = [...(data.payload as TourEntry).dancers.map(d => d.photoPath), (data.payload as TourEntry).duoPhotoPath].filter((p): p is string => !!p);
        const urls = await Promise.allSettled(paths.map(previewRegistrationPhoto));
        if (active) setPhotos(urls.flatMap(r => r.status === 'fulfilled' ? [r.value] : []));
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Chargement impossible.'); }
    }
    void load();
    return () => { active = false; };
  }, [draftId]);
  async function sign() {
    if (!draftId || !entry || !agreed || !signerName.trim()) return;
    setBusy(true); setError('');
    try { await signParisRules(draftId, signerName, agreed); setSigned(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Signature impossible.'); }
    finally { setBusy(false); }
  }
  return <Screen><PageHeader title="Signer le règlement · Paris" subtitle="Juste Debout 2027" />
    {entry && <Card><T variant="h3">{entry.category} · {entry.category === 'Junior Dance Tour' ? 'Solo' : '2 vs 2'}</T>{entry.dancers.map((d, i) => <T key={i}>{d.name} · {d.alias || 'Sans nom de scène'}</T>)}{entry.category === 'Junior Dance Tour' && <T>Responsable légal : {entry.guardianName}</T>}<T variant="small">Cette signature ne valide pas encore l’inscription et ne réserve aucune place. Chaque personne signe avec son propre compte ; le responsable légal signe pour le JDT.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{photos.map(url => <Image key={url} source={{ uri: url }} accessibilityLabel="Photo du dossier d’inscription" style={{ width: 120, height: 120, marginTop: 12 }} />)}</View>
    </Card>}
    <Card style={{ marginTop: 16 }}><T variant="small">Version : {PARIS_RULES_VERSION}</T><T style={{ marginTop: 12 }}>{PARIS_RULES_TEXT}</T></Card>
    {entry && !signed && <Card style={{ marginTop: 16 }}><T>Signature : saisis ton nom complet, tel qu’il figure dans ce dossier.</T><TextInput accessibilityLabel="Nom complet du signataire" value={signerName} onChangeText={setSignerName} style={{ borderWidth: 1, borderColor: c.border, color: c.text, padding: 12, marginTop: 12 }} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed(v => !v)} style={{ paddingVertical: 16 }}><T>{agreed ? '☑' : '☐'} J’ai lu ce règlement et je l’accepte. En saisissant mon nom et en cliquant sur « Signer », je signe personnellement pour moi-même, ou en qualité de responsable légal pour le JDT.</T></Pressable>
      <Pressable accessibilityRole="button" disabled={busy || !agreed || !signerName.trim()} onPress={sign} style={{ backgroundColor: c.accent, padding: 16, opacity: busy || !agreed || !signerName.trim() ? 0.4 : 1 }}><T color={c.black}>Signer le règlement</T></Pressable>
    </Card>}
    {signed && <Card><T>Ta signature a été enregistrée. La validation définitive exige les signatures de tous les participants concernés. Toute modification du dossier demandera de signer à nouveau.</T></Card>}
    {entry && <Pressable accessibilityRole="button" onPress={() => Share.share({ message: `Connecte-toi avec ton e-mail indiqué dans notre dossier pour signer le règlement Juste Debout Paris : https://justedeboutapp.com/paris-rules-sign?draftId=${encodeURIComponent(draftId)}` })} style={{ padding: 16 }}><T>Partager le lien de signature avec mon partenaire</T></Pressable>}
    {busy && <ActivityIndicator color={c.accent} />}{!!error && <T color={c.danger}>{error}</T>}
  </Screen>;
}
