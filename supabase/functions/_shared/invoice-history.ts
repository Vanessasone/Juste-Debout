import type Stripe from "npm:stripe@^22";
import type {SupabaseClient} from "npm:@supabase/supabase-js@2.110.1";

// Read verified historic Stripe payments; never invent an address or change the
// buyer's email. This operation creates no charge and resends no existing invoice.
export async function reconcileInvoiceHistory(admin:SupabaseClient,stripe:Stripe,cursor?:string) {
 let query=admin.from('ticket_orders').select('id,status,currency,total_cents,customer_email,customer_name,billing_address,stripe_checkout_session_id,ticket_order_items(product_code)')
  .eq('event_id','eb0025ca-b597-4708-9d47-b24ebbf507b5').in('status',['paid','refunded'])
  .gte('paid_at','2026-10-08T19:00:00Z').order('id').limit(15);
 if(cursor)query=query.gt('id',cursor);
 const {data:orders,error}=await query;
 if(error)throw Error('invoice_history_query_failed');
 const result={examined:0,eligible:0,missing_address:0,missing_name:0,excluded_test:0,failed:0,next_cursor:null as string|null,failures:[] as {reference:string;code:string}[]};
 for(const order of orders??[]) {
  result.next_cursor=order.id;result.examined++;
  if(order.ticket_order_items?.some((i:{product_code:string})=>/^(internal_|test_)/.test(i.product_code))) {result.excluded_test++;continue;}
  try {
   const session=await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id,{expand:['payment_intent.payment_method','payment_intent.latest_charge']});
   if(session.payment_status!=='paid'||session.amount_total!==order.total_cents||session.currency!==order.currency.toLowerCase()||session.metadata?.order_id!==order.id)throw Error('historic_payment_mismatch');
   const email=session.customer_details?.email??session.customer_email;
   if(!email||email.toLowerCase()!==order.customer_email?.toLowerCase())throw Error('historic_buyer_email_mismatch');
   const intent=typeof session.payment_intent==='object'?session.payment_intent:null;
   const method=typeof intent?.payment_method==='object'?intent.payment_method:null;
   const charge=typeof intent?.latest_charge==='object'?intent.latest_charge:null;
   const name=order.customer_name?.trim()||session.customer_details?.individual_name||session.customer_details?.name||method?.billing_details?.name||charge?.billing_details?.name;
   const addresses=[order.billing_address,session.customer_details?.address,method?.billing_details?.address,charge?.billing_details?.address];
   const address=addresses.find(a=>a?.line1?.trim()&&a?.country?.trim());
   if(!name)result.missing_name++;
   if(!address)result.missing_address++;
   if(!name||!address)continue;
   const {error:updateError}=await admin.from('ticket_orders').update({customer_name:name,billing_address:address}).eq('id',order.id);
   if(updateError)throw Error('historic_billing_save_failed');
   // The existing paid-order trigger queues the invoice; its unique order ID
   // and snapshot prevent duplicates even if this operation is repeated.
   result.eligible++;
  } catch(e) {
   result.failed++;result.failures.push({reference:order.id.slice(0,8),code:e instanceof Error&&e.message.startsWith('historic_')?e.message:'historic_stripe_lookup_failed'});
  }
 }
 if((orders??[]).length<15)result.next_cursor=null;
 return result;
}
