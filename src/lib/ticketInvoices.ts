import { supabase } from '@/lib/supabase';
import { serverRequest } from '@/lib/serverRequest';
export type TicketInvoice={id:string;number:string;issued_at:string;ready_at:string|null;snapshot:{currency:string;total_cents:number;event:{title:string}}};
export async function getTicketInvoices() {
 const {data,error}=await serverRequest(signal=>supabase.from('ticket_invoices')
  .select('id,number,issued_at,ready_at,snapshot').order('issued_at',{ascending:false}).abortSignal(signal));
 if(error)throw error;
 return (data??[]) as TicketInvoice[];
}
export async function getTicketInvoiceUrl(invoiceId:string) {
 const {data,error}=await serverRequest(signal=>supabase.functions.invoke('download-ticket-invoice',{body:{invoiceId},signal}));
 if(error||!data?.url)throw error??new Error('invoice_download_unavailable');
 return data.url as string;
}
