import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

export type InvoiceSnapshot = {
 order_id: string; paid_at: string; currency: string;
 subtotal_cents: number; discount_cents: number; total_cents: number;
 seller: { name: string; address: string; registration: string; vat_number: string | null; vat_rate_bps: number; exemption_note: string | null };
 buyer: { name: string; email: string; address: Record<string, string | null> };
 event: { title: string; starts_on: string; ends_on: string };
 items: { name: string; quantity: number; unit_price_cents: number; access_date: string | null; access_days: number }[];
};
export type InvoiceDocument = { id: string; number: string; issued_at: string; snapshot: InvoiceSnapshot };

// Integer allocation ensures discounts and rounding sum exactly to the paid total.
function allocate(total: number, weights: number[]) {
 const sum = weights.reduce((a,b)=>a+b,0);
 if (!sum) return weights.map(()=>0);
 let cumulative = 0, previous = 0;
 return weights.map(weight => {
  cumulative += weight;
  const next = Math.round(total * cumulative / sum);
  const part = next-previous; previous=next; return part;
 });
}
export function invoiceAmounts(s: InvoiceSnapshot) {
 const gross = s.items.map(i=>i.unit_price_cents*i.quantity);
 if (!s.items.length || s.items.some(i=>!Number.isSafeInteger(i.quantity)||i.quantity<1||!Number.isSafeInteger(i.unit_price_cents)||i.unit_price_cents<0)
 || gross.reduce((a,b)=>a+b,0)!==s.subtotal_cents || s.total_cents!==s.subtotal_cents-s.discount_cents
 || !Number.isSafeInteger(s.total_cents)||s.total_cents<=0||s.discount_cents<0||s.discount_cents>s.subtotal_cents
 || !Number.isInteger(s.seller.vat_rate_bps)||s.seller.vat_rate_bps<0||s.seller.vat_rate_bps>10000) throw Error("invoice_amount_mismatch");
 const discounts=allocate(s.discount_cents,gross);
 const totals=gross.map((g,i)=>g-discounts[i]);
 const net=Math.round(s.total_cents*10000/(10000+s.seller.vat_rate_bps));
 return {net,vat:s.total_cents-net,totals,discounts,nets:allocate(net,totals)};
}

export async function renderInvoicePdf(inv: InvoiceDocument, fontBytes: Uint8Array, cjkBytes?:Uint8Array) {
 const s=inv.snapshot, amounts=invoiceAmounts(s);
 const doc=await PDFDocument.create(); doc.registerFontkit({create:(bytes: Uint8Array)=>{
 const face=fontkit.create(bytes) as ReturnType<typeof fontkit.create> & {
  variationAxes?:Record<string,unknown>;getVariation:(axes:Record<string,number>)=>ReturnType<typeof fontkit.create>;
 };
 return face.variationAxes?.wght ? face.getVariation({wght:400}) : face;
 }});
 const font=await doc.embedFont(fontBytes,{subset:true});
 const supported=new Set(font.getCharacterSet());
 const cjk=cjkBytes?await doc.embedFont(cjkBytes,{subset:true}):undefined;
 const cjkSupported=new Set(cjk?.getCharacterSet()??[]);
 const characterFont=(char:string)=>{
  const cp=char.codePointAt(0)!;
  if(supported.has(cp))return font;
  if(cjk&&cjkSupported.has(cp))return cjk;
  throw Error('invoice_font_missing_glyph');
 };
 const measureWidth=(value:string,size:number)=>Array.from(value).reduce((sum,char)=>sum+characterFont(char).widthOfTextAtSize(char,size),0);
 const money=(n:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:s.currency}).format(n/100).replace(/\u202f|\u00a0/g,' ');
 const date=(v:string)=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris'}).format(new Date(v.length===10?v+'T12:00:00Z':v));
 let page=doc.addPage([595.28,841.89]), y=796;
 const dark=rgb(.07,.07,.07), grey=rgb(.35,.35,.35);
 const newPage=()=>{page=doc.addPage([595.28,841.89]);y=796;};
 function lines(value:string,width:number,size:number) {
  const result:string[]=[];
  for(const paragraph of value.replace(/[\r\t]/g,' ').split('\n')) {
   let line='';
   // Breaking by Unicode codepoint also supports long names and CJK addresses.
   for(const char of paragraph) {
    characterFont(char);
    if(line && Array.from(line+char).reduce((sum,ch)=>sum+characterFont(ch).widthOfTextAtSize(ch,size),0)>width) {result.push(line.trim());line='';}
    line+=char;
   }
   result.push(line.trim());
  }
  return result;
 }
 function text(value:string,size=10,width=499,color=dark) {
  for(const line of lines(value,width,size)) {
   if(y<74)newPage();
   let x=48,run='',runFont=font;
   const flush=()=>{if(run){page.drawText(run,{x,y,size,font:runFont,color});x+=measureWidth(run,size);run='';}};
   for(const char of line){const selected=characterFont(char);if(selected!==runFont){flush();runFont=selected;}run+=char;}
   flush();y-=size+6;
  }
 }
 function gap(n=12){y-=n;}
 text('JUSTE DEBOUT',22);text('FACTURE ACQUITTÉE',16);gap();
 text(inv.number,12);text('Émise le '+date(inv.issued_at)+' • Payée le '+date(s.paid_at));
 text('Commande : '+s.order_id,8,499,grey);gap();
 page.drawRectangle({x:48,y:y-3,width:499,height:3,color:rgb(.71,.98,.26)});gap(18);
 text('ÉMETTEUR',9,499,grey);text(s.seller.name,12);text(s.seller.address);text(s.seller.registration);
 if(s.seller.vat_number)text('N° TVA : '+s.seller.vat_number);gap();
 text('FACTURÉ À',9,499,grey);text(s.buyer.name,12);text(s.buyer.email);
 const a=s.buyer.address;
 text([a.line1,a.line2,[a.postal_code,a.city].filter(Boolean).join(' '),a.state,a.country].filter(Boolean).join('\n'));
 gap();text(s.event.title,12);
 text('Dates de l’événement : '+date(s.event.starts_on)+' – '+date(s.event.ends_on));gap();
 for(let i=0;i<s.items.length;i++) {
  const item=s.items[i];
  const detail=item.access_date ? ' • Accès le '+date(item.access_date)+(item.access_days>1?' • '+item.access_days+' jours':'') : '';
  const nameLines=lines(item.name,499,11);
  if(y-(nameLines.length*17+80)<74)newPage();
  text(item.name,11);
  text(item.quantity+' × '+money(item.unit_price_cents)+' TTC'+detail,9,499,grey);
  if(amounts.discounts[i])text('Remise : −'+money(amounts.discounts[i]),9,499,grey);
  text('Total HT : '+money(amounts.nets[i])+' • TVA : '+(s.seller.vat_rate_bps/100)+' % • Total TTC : '+money(amounts.totals[i]),9);
  gap();
 }
 if(y<200)newPage();
 text('Sous-total avant remise : '+money(s.subtotal_cents));
 if(s.discount_cents)text('Remise totale : −'+money(s.discount_cents));
 text('Total HT : '+money(amounts.net));text('TVA ('+(s.seller.vat_rate_bps/100)+' %) : '+money(amounts.vat));
 text('TOTAL TTC PAYÉ : '+money(s.total_cents),15);text('Reste à payer : '+money(0));gap();
 if(s.seller.exemption_note)text(s.seller.exemption_note,9,499,grey);
 text('Paiement en ligne à la commande. Cette facture ne constitue pas un billet d’entrée.',9,499,grey);
 const pages=doc.getPages();
 pages.forEach((p,i)=>p.drawText(inv.number+' • '+(i+1)+' / '+pages.length,{x:48,y:36,font,size:8,color:grey}));
 doc.setTitle('Facture '+inv.number);doc.setAuthor(s.seller.name);doc.setSubject('Billetterie Juste Debout');
 doc.setCreationDate(new Date(inv.issued_at));doc.setModificationDate(new Date(inv.issued_at));
 return doc.save();
}
