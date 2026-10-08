import { useCustomerText } from '@/lib/customerText';
import { useI18n } from '@/lib/i18n';
import { ticketProductText } from '@/lib/ticketProductText';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { Card, PageHeader, Screen, Section, T } from '@/components/ui';
import { Radius, Space } from '@/constants/brand';
import { ThemeColors } from '@/constants/theme';
import { cancelTicketTransfer, getMyTickets, Ticket } from '@/lib/tickets';
import { createTransferBatch, parseRecipientList } from '@/lib/ticketTransferBatch';
import { useColors } from '@/lib/theme';

export default function ManageTickets() {
  const ct=useCustomerText();const {locale}=useI18n();
  const c=useColors(); const styles=useMemo(()=>makeStyles(c),[c]); const router=useRouter();
  const [tickets,setTickets]=useState<Ticket[]>([]); const [raw,setRaw]=useState('');
  const [busy,setBusy]=useState(false);
  const [links,setLinks]=useState<Array<{email:string;link:string}>>([]);
  const [allTickets,setAllTickets]=useState<Ticket[]>([]);
  const load=()=>getMyTickets().then((x)=>{setTickets(x);setAllTickets(x);}).catch(()=>{setTickets([]);setAllTickets([]);});
  useEffect(()=>{load();},[]);
  const available=tickets.filter(t=>t.status==='active' && !t.ticket_products?.code?.startsWith('family_') && (!t.transfer_status || t.transfer_status==='owned'));
  const mjcCount=tickets.filter(t=>t.ticket_products?.code?.startsWith('mjc_')).length;
  const parsed=parseRecipientList(raw);
  const canSend=parsed.valid.length>0 && parsed.valid.length<=available.length && !busy;

  const submit=async()=>{
    if(!canSend)return; setBusy(true);
    try{
      const result=await createTransferBatch(available,parsed.valid,locale);
      setLinks(result.invitationLinks);
      await load();
      Alert.alert(ct('groupTitle'),`${ct('groupPrepared',{n:result.invitationLinks.length})}${result.failedCount ? `\n${ct('groupFailed',{n:result.failedCount})}` : ''}`);
    }catch(e:any){Alert.alert(ct('error'),ct('groupImportError'));}
    finally{setBusy(false);}
  };

  return <Screen>
    <PageHeader title={ct('groupTitle')} subtitle={ct('groupSubtitle')} />
    <Card>
      <T variant="h3">{ct('groupAvailable',{n:available.length})}</T>
      {mjcCount>0 && <T variant="small" color={c.primary} style={{marginTop:6}}>{ct('groupMJC',{n:mjcCount})}</T>}
      <T variant="small" color={c.textDim} style={{marginTop:6}}>{ct('groupInstructions')}</T>
    </Card>
    <Section title={ct('groupFollow')}>
      {allTickets.filter(t=>t.status==='active').map((t,i)=>{
        const pending=t.transfer_status==='pending';
        const accepted=t.transfer_status==='accepted';
        return <Card key={t.id} style={{marginBottom:Space.sm}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
            <View style={{flex:1}}>
              <T variant="caption" color={accepted?c.primary:pending?c.accent:c.textMute}>{accepted?ct('groupClaimed'):pending?ct('invitePending'):ct('groupAssign')}</T>
              <T variant="small" style={{marginTop:3}}>{t.transfer_email || t.holder_email || `${ct('myTicket')} ${i+1}`}</T>
              <T variant="caption" color={c.textMute} style={{marginTop:2}}>{ticketProductText(t.ticket_products?.code ?? '',locale,{name:t.ticket_products?.name ?? t.type}).name} · #{t.id.slice(0,8).toUpperCase()}</T>
            </View>
            {pending && <Pressable onPress={async()=>{try{await cancelTicketTransfer(t.id);await load();}catch(e:any){Alert.alert(ct('error'),ct('cancelError'))}}} style={styles.smallBtn}><T variant="caption" color={c.danger}>{ct('groupCorrect')}</T></Pressable>}
          </View>
        </Card>
      })}
    </Section>
    {links.length>0 && <Section title={ct('groupLinks')}>
      <Card>
        <T variant="small" color={c.textDim}>{ct('groupLinkPrivacy')}</T>
        <Pressable onPress={async()=>{await Clipboard.setStringAsync(links.map(x=>x.email+' ; '+x.link).join('\n'));Alert.alert(ct('copied'),ct('groupLinks'));}} style={styles.send}><T variant="label" color={c.black}>{ct('copyAll')}</T></Pressable>
      </Card>
      {links.map(x=><Card key={x.email} style={{marginTop:Space.sm}}>
        <T variant="small">{x.email}</T>
        <Pressable onPress={async()=>{await Clipboard.setStringAsync(x.link);Alert.alert(ct('copied'),ct('copyOne'));}} style={styles.smallBtn}><T variant="caption" color={c.primary}>{ct('copyOne')}</T></Pressable>
      </Card>)}
    </Section>}
    <Section title={ct('groupImport')}>
      <TextInput multiline value={raw} onChangeText={setRaw} placeholder={"Marie ; Dupont ; marie@email.com\nPaul ; Martin ; paul@email.com"} placeholderTextColor={c.textMute} style={styles.area}/>
      <View style={styles.stats}>
        <Stat n={parsed.valid.length} label={ct('validRows')} c={c}/><Stat n={parsed.duplicates.length} label={ct('duplicateRows')} c={c}/><Stat n={parsed.invalid.length} label={ct('invalidRows')} c={c}/>
      </View>
      {parsed.valid.length>available.length && <T variant="small" color={c.danger}>{ct('groupOverflow',{n:parsed.valid.length,available:available.length})}</T>}
      {parsed.invalid.length>0 && <Card style={{marginTop:Space.md}}><T variant="caption" color={c.danger}>{ct('correctRows')}</T>{parsed.invalid.slice(0,8).map((x,i)=><T key={i} variant="small" color={c.textDim} style={{marginTop:4}}>{x}</T>)}</Card>}
      <Pressable disabled={!canSend} onPress={submit} style={[styles.send,!canSend&&{opacity:.35}]}>
        <T variant="label" color={c.black}>{busy?ct('wait'):ct('assignTickets',{n:parsed.valid.length})}</T>
      </Pressable>
      <T variant="caption" color={c.textMute} style={{textAlign:'center',marginTop:10}}>{ct('remainWallet',{n:Math.max(0,available.length-parsed.valid.length)})}</T>
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
