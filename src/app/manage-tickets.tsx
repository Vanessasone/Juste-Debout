import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Card, PageHeader, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { cancelTicketTransfer, getMyTickets, Ticket } from '@/lib/tickets';
import { createTransferBatch, parseRecipientList } from '@/lib/ticketTransferBatch';
import { useColors } from '@/lib/theme';

export default function ManageTickets() {
  const c=useColors(); const styles=useMemo(()=>makeStyles(c),[c]); const router=useRouter();
  const [tickets,setTickets]=useState<Ticket[]>([]); const [raw,setRaw]=useState('');
  const [busy,setBusy]=useState(false);
  const [allTickets,setAllTickets]=useState<Ticket[]>([]);
  const load=()=>getMyTickets().then((x)=>{setTickets(x);setAllTickets(x);}).catch(()=>{setTickets([]);setAllTickets([]);});
  useEffect(()=>{load();},[]);
  const available=tickets.filter(t=>t.status==='active' && (!t.transfer_status || t.transfer_status==='owned'));
  const parsed=parseRecipientList(raw);
  const canSend=parsed.valid.length>0 && parsed.valid.length<=available.length && !busy;

  const submit=async()=>{
    if(!canSend)return; setBusy(true);
    try{
      await createTransferBatch(available,parsed.valid);
      Alert.alert('Attributions préparées',`${parsed.valid.length} billet(s) ont été attribués. Les destinataires pourront les récupérer avec leur compte Juste Debout dès que les invitations email seront activées.`);
      router.replace('/(tabs)/tickets');
    }catch(e:any){Alert.alert('Import impossible',e?.message??'Réessaie plus tard.');}
    finally{setBusy(false);}
  };

  return <Screen>
    <PageHeader title="Gérer mon groupe" subtitle="Attribue plusieurs billets en quelques secondes" />
    <Card>
      <T variant="h3">{available.length} billet{available.length>1?'s':''} disponible{available.length>1?'s':''}</T>
      <T variant="small" color={c.textDim} style={{marginTop:6}}>Colle une liste depuis Excel, Numbers ou Google Sheets. Formats acceptés : Prénom ; Nom ; Email, ou simplement une adresse email par ligne.</T>
    </Card>
    <Section title="Suivi des participants">
      {allTickets.filter(t=>t.status==='active').map((t,i)=>{
        const pending=t.transfer_status==='pending';
        const accepted=t.transfer_status==='accepted';
        return <Card key={t.id} style={{marginBottom:Space.sm}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
            <View style={{flex:1}}>
              <T variant="caption" color={accepted?c.primary:pending?c.accent:c.textMute}>{accepted?'✓ RÉCUPÉRÉ':pending?'EN ATTENTE':'À ATTRIBUER'}</T>
              <T variant="small" style={{marginTop:3}}>{t.transfer_email || t.holder_email || `Billet ${i+1}`}</T>
              <T variant="caption" color={c.textMute} style={{marginTop:2}}>{t.ticket_products?.name ?? t.type} · #{t.id.slice(0,8).toUpperCase()}</T>
            </View>
            {pending && <Pressable onPress={async()=>{try{await cancelTicketTransfer(t.id);await load();}catch(e:any){Alert.alert('Erreur',e?.message??'Impossible d’annuler.')}}} style={styles.smallBtn}><T variant="caption" color={c.danger}>CORRIGER</T></Pressable>}
          </View>
        </Card>
      })}
    </Section>
    <Section title="Importer les participants">
      <TextInput multiline value={raw} onChangeText={setRaw} placeholder={"Marie ; Dupont ; marie@email.com\nPaul ; Martin ; paul@email.com"} placeholderTextColor={c.textMute} style={styles.area}/>
      <View style={styles.stats}>
        <Stat n={parsed.valid.length} label="valides" c={c}/><Stat n={parsed.duplicates.length} label="doublons" c={c}/><Stat n={parsed.invalid.length} label="invalides" c={c}/>
      </View>
      {parsed.valid.length>available.length && <T variant="small" color={c.danger}>Tu as importé {parsed.valid.length} personnes mais seulement {available.length} billets sont disponibles.</T>}
      {parsed.invalid.length>0 && <Card style={{marginTop:Space.md}}><T variant="caption" color={c.danger}>LIGNES À CORRIGER</T>{parsed.invalid.slice(0,8).map((x,i)=><T key={i} variant="small" color={c.textDim} style={{marginTop:4}}>{x}</T>)}</Card>}
      <Pressable disabled={!canSend} onPress={submit} style={[styles.send,!canSend&&{opacity:.35}]}>
        <T variant="label" color={c.black}>{busy?'UN INSTANT…':`ATTRIBUER ${parsed.valid.length} BILLET${parsed.valid.length>1?'S':''}`}</T>
      </Pressable>
      <T variant="caption" color={c.textMute} style={{textAlign:'center',marginTop:10}}>{Math.max(0,available.length-parsed.valid.length)} billet(s) resteront dans ton wallet.</T>
    </Section>
  </Screen>;
}
function Stat({n,label,c}:{n:number;label:string;c:ThemeColors}){return <View style={{alignItems:'center',flex:1}}><T variant="h2" color={c.accent}>{n}</T><T variant="caption" color={c.textMute}>{label}</T></View>}
const makeStyles=(c:ThemeColors)=>StyleSheet.create({
 area:{minHeight:190,textAlignVertical:'top',backgroundColor:c.surface,borderWidth:1,borderColor:c.border,borderRadius:Radius.lg,padding:16,color:c.text,fontSize:15},
 stats:{flexDirection:'row',backgroundColor:c.surface2,borderRadius:Radius.md,paddingVertical:14,marginVertical:Space.md},
 smallBtn:{paddingVertical:9,paddingHorizontal:10,borderWidth:1,borderColor:c.border,borderRadius:Radius.pill},
 send:{backgroundColor:c.primary,borderRadius:Radius.pill,paddingVertical:16,alignItems:'center',marginTop:Space.lg}
});
