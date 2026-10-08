export function validateFamilyRecipients(tickets: { id: string; ticket_products?: { code: string } | null }[], names: Record<string,string>, births: Record<string,string>): 'familyIncomplete' | 'invalidContact' | 'birthError' | 'familyUnder12' | null {
  if(tickets.length !== 4) return 'familyIncomplete';
  for(let i=0;i<tickets.length;i++) {
    const ticket=tickets[i], name=names[ticket.id]?.trim() ?? '';
    if(name.length<2 || name.length>120) return 'invalidContact';
    if(i<2) continue;
    const birth=births[ticket.id] ?? '';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return 'birthError';
    const date=new Date(birth+'T12:00:00Z');
    if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==birth) return 'birthError';
    const lastDay=['family_sun','family_two_days'].includes(ticket.ticket_products?.code ?? '')?'2027-03-14':'2027-03-13';
    const oldest=lastDay.replace('2027','2015');
    if(birth<=oldest || birth>lastDay) return 'familyUnder12';
  }
  return null;
}
