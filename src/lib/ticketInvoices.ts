import { supabase } from '@/lib/supabase';
import { serverRequest } from '@/lib/serverRequest';
export type TicketInvoice={id:string;number:string;issued_at:string;ready_at:string|null;snapshot:{currency:string;total_cents:number;event:{title:string}}};
export type MissingInvoiceDetails={id:string;customer_name:string|null};
export async function getMissingInvoiceDetails(userId:string) {
 const {data,error}=await serverRequest(signal=>supabase.from('ticket_orders').select('id,customer_name')
  .eq('user_id',userId).eq('event_id','eb0025ca-b597-4708-9d47-b24ebbf507b5').in('status',['paid','refunded'])
  .gte('paid_at','2026-10-08T19:00:00Z').is('billing_address',null).abortSignal(signal));
 if(error)throw error;return (data??[]) as MissingInvoiceDetails[];
}
export async function completeInvoiceDetails(name:string,address:Record<string,string>) {
 const {data,error}=await serverRequest(signal=>supabase.rpc('complete_my_ticket_invoice_details',{p_name:name.trim(),p_address:address}).abortSignal(signal));
 if(error||!data?.ok)throw error??new Error('billing_details_failed');return data.queued as number;
}
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
