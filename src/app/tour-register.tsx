import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Card, PageHeader, Screen, Section, T } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { emptyDancer, TOUR_STOPS, validateEntry, type TourEntry } from '@/lib/tourRegistration';

export default function TourRegister() {
  const c = useColors();
  const [entry, setEntry] = useState<TourEntry>({ stop: 'chongqing', category: '', teamName: '', dancers: [emptyDancer(), emptyDancer()], guardianName: '', guardianEmail: '', guardianPhone: '', guardianConsent: false, consent: false });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const stop = TOUR_STOPS.find(s => s.slug === entry.stop)!;
  const junior = entry.category === 'Junior Dance Tour';
  const update = (patch: Partial<TourEntry>) => { setEntry(v => ({ ...v, ...patch })); setSaved(false); setReview(false); setError(''); };
  const input = (label: string, value: string, change: (v: string) => void, email = false) => <View style={{ marginTop: 12 }}><T variant="small">{label}</T><TextInput accessibilityLabel={label} value={value} onChangeText={change} autoCapitalize={email ? 'none' : 'words'} keyboardType={email ? 'email-address' : 'default'} style={{ color: c.text, borderColor: c.border, borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 4 }} /></View>;
  const choice = (label: string, active: boolean, click: () => void) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={click} style={{ padding: 12, borderWidth: 1, borderColor: active ? c.accent : c.border, borderRadius: 8, margin: 4 }}><T>{label}</T></Pressable>;
  const check = (label: string, value: boolean, click: () => void) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={click} style={{ paddingVertical: 12 }}><T variant="small">{value ? '☑' : '☐'} {label}</T></Pressable>;
  async function loadDraft() {
    setBusy(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Connecte-toi pour retrouver ton brouillon.');
      const { data, error: dbError } = await supabase.from('tour_registration_drafts').select('payload').eq('profile_id', user.id).eq('stop_slug', entry.stop).eq('category', entry.category).maybeSingle();
      if (dbError) throw new Error('Les brouillons ne sont pas encore disponibles.');
      if (!data) throw new Error('Aucun brouillon pour cette édition et cette discipline.');
      const draft = data.payload as TourEntry;
      if (validateEntry(draft)) throw new Error('Ce brouillon doit être vérifié avant de le reprendre.');
      update(draft);
    } catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.'); }
    finally { setBusy(false); }
  }
  async function saveDraft() {
    const issue = validateEntry(entry);
    if (issue) { setError(issue); return; }
    setBusy(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Connecte-toi pour enregistrer ton brouillon.');
      const { error: dbError } = await supabase.from('tour_registration_drafts').upsert({ profile_id: user.id, stop_slug: entry.stop, category: entry.category, payload: entry }, { onConflict: 'profile_id,stop_slug,category' });
      if (dbError) throw new Error('L’enregistrement des brouillons n’est pas encore disponible. Tes informations restent affichées ici.');
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }
  return <Screen><PageHeader title="Inscriptions danseurs · 2027" subtitle="Juste Debout" />
    <Card><T variant="small">Prépare ton inscription. Les inscriptions définitives ne sont pas encore ouvertes. Un brouillon ne réserve aucune place et aucun paiement n’est demandé.</T></Card>
    <Section title="1 · Ton édition"><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{TOUR_STOPS.map(s => choice(s.name, s.slug === entry.stop, () => update({ stop: s.slug, category: '', dancers: [emptyDancer(), emptyDancer()], guardianName: '', guardianEmail: '', guardianPhone: '', guardianConsent: false, consent: false })))}</View>
      <T variant="small">{stop.date}{stop.endDate ? ` → ${stop.endDate}` : ''} · {stop.venue || 'Adresse à communiquer'}</T>
      {stop.slug === 'paris' && <T variant="small">Prélims : 11–12 mars. Finales : 13–14 mars au Stade Pierre de Coubertin. Ce formulaire prépare une inscription aux prélims.</T>}
    </Section>
    <Section title="2 · Ta discipline"><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[...stop.categories, ...(stop.junior ? ['Junior Dance Tour'] : [])].map(cat => choice(cat, entry.category === cat, () => update({ category: cat, dancers: cat === 'Junior Dance Tour' ? [emptyDancer()] : [emptyDancer(), emptyDancer()], guardianName: '', guardianEmail: '', guardianPhone: '', guardianConsent: false, consent: false })))}</View></Section>
    {!!entry.category && <Section title={junior ? '3 · Participant Junior Dance Tour' : '3 · Ton binôme'}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={loadDraft} style={{ paddingVertical: 12 }}><T>Reprendre mon brouillon pour cette discipline</T></Pressable>
      <T variant="small">{junior ? 'Solo · all styles. De 6 à 14 ans inclus au 13 mars 2027 : naissance du 14 mars 2012 au 13 mars 2021 inclus.' : '2 vs 2 · renseigne les deux danseurs.'}</T>
      {!junior && input('Nom du duo (facultatif)', entry.teamName, v => update({ teamName: v }))}
      {entry.dancers.map((d, i) => <Card key={i} style={{ marginTop: 16 }}><T variant="h3">{junior ? 'Participant' : `Danseur ${i + 1}`}</T>{(['name', 'alias', 'email', 'country', ...(junior ? ['birthDate'] : [])] as const).map(key => <View key={key}>{input(`${({ name: 'Nom complet', alias: 'Nom de scène (facultatif)', email: 'E-mail', country: 'Pays', birthDate: 'Date de naissance (AAAA-MM-JJ)' })[key as keyof typeof d]} · ${i + 1}`, d[key as keyof typeof d], v => update({ dancers: entry.dancers.map((p, n) => n === i ? { ...p, [key]: v } : p) }), key === 'email')}</View>)}</Card>)}
      {junior && <Card style={{ marginTop: 16 }}><T variant="h3">Responsable légal</T>{input('Nom du responsable légal', entry.guardianName, v => update({ guardianName: v }))}{input('E-mail du responsable légal', entry.guardianEmail, v => update({ guardianEmail: v }), true)}{input('Téléphone du responsable légal', entry.guardianPhone, v => update({ guardianPhone: v }))}{check('Je suis le responsable légal et j’autorise la participation de cet enfant.', entry.guardianConsent, () => update({ guardianConsent: !entry.guardianConsent }))}</Card>}
      {check('J’autorise le traitement de ces données pour gérer ce dossier et confirme avoir l’accord de mon partenaire, le cas échéant.', entry.consent, () => update({ consent: !entry.consent }))}
      <Pressable accessibilityRole="button" onPress={() => { const issue = validateEntry(entry); setError(issue || ''); setReview(!issue); }} style={{ padding: 16, borderWidth: 1, borderColor: c.accent, borderRadius: 8 }}><T>Vérifier mon dossier</T></Pressable>
    </Section>}
    {review && <Card><T variant="h3">Récapitulatif</T><T>{stop.name} · {entry.category} · {junior ? 'Solo' : '2 vs 2'}</T>{entry.dancers.map((d, i) => <T key={i} variant="small">{d.name} {d.alias ? `(${d.alias})` : ''} · {d.email} · {d.country}{junior ? ` · ${d.birthDate}` : ''}</T>)}{junior && <T variant="small">Responsable légal : {entry.guardianName} · {entry.guardianEmail} · {entry.guardianPhone}</T>}
      <Pressable accessibilityRole="button" disabled={busy} onPress={saveDraft} style={{ padding: 16 }}>{busy ? <ActivityIndicator color={c.accent} /> : <T>Enregistrer mon brouillon</T>}</Pressable>
    </Card>}
    {!!error && <T color={c.danger}>{error}</T>}{saved && <Card><T>Brouillon enregistré. Aucune inscription définitive ni place réservée.</T></Card>}
  </Screen>;
}
