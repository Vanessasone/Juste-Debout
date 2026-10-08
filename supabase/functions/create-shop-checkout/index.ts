import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@^22";
import { createClient } from "npm:@supabase/supabase-js@2.110.1";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const url=Deno.env.get("SUPABASE_URL")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, sk=Deno.env.get("STRIPE_SECRET_KEY")!;
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const {data:au}=await admin.auth.getUser(token); const user=au.user;
  if(!user)return Response.json({error:"unauthorized"},{status:401,headers:cors});
  const b=await req.json(); const qty=Math.max(1,Math.min(20,Math.floor(Number(b.quantity||1))));
  const {data:p,error:pe}=await admin.from("products").select("id,name,price,currency,sold_out").eq("id",b.productId).single();
  if(pe||!p||p.sold_out||p.price==null)return Response.json({error:"product_unavailable"},{status:409,headers:cors});
  const {data:bc}=await admin.from("black_cards").select("id,merchandise_discount_percent,valid_until,status").eq("profile_id",user.id).eq("status","active").gt("valid_until",new Date().toISOString()).order("valid_until",{ascending:false}).limit(1).maybeSingle();
  const base=Math.round(Number(p.price)*100); const pct=bc?.merchandise_discount_percent??0; const unit=Math.round(base*(1-pct/100));
  const subtotal=base*qty, discount=(base-unit)*qty, total=unit*qty;
  const a=b.address||{};
  if(!a.full_name||!a.address_line1||!a.postal_code||!a.city||!a.country)return Response.json({error:"invalid_address"},{status:400,headers:cors});
  const {data:o,error:oe}=await admin.from("orders").insert({profile_id:user.id,status:"pending",currency:p.currency||"EUR",subtotal,discount,total,black_card_id:bc?.id??null,full_name:String(a.full_name).trim(),phone:a.phone?.trim()||null,address_line1:String(a.address_line1).trim(),address_line2:a.address_line2?.trim()||null,postal_code:String(a.postal_code).trim(),city:String(a.city).trim(),country:String(a.country).trim(),note:a.note?.trim()||null}).select("id").single();
  if(oe)throw oe;
  await admin.from("order_items").insert({order_id:o.id,product_id:p.id,name:p.name,unit_price:unit,quantity:qty});
  const stripe=new Stripe(sk);
  const session=await stripe.checkout.sessions.create({mode:"payment",customer_email:user.email??undefined,success_url:"https://justedeboutapp.com/shop-success?session_id={CHECKOUT_SESSION_ID}",cancel_url:"https://justedeboutapp.com/(tabs)/marketplace",metadata:{kind:"shop_order",order_id:o.id,user_id:user.id,black_card:bc?.id??""},line_items:[{quantity:qty,price_data:{currency:(p.currency||"EUR").toLowerCase(),unit_amount:unit,product_data:{name:p.name}}}],shipping_address_collection:{allowed_countries:["FR","BE","DE","ES","IT","NL","GB","US","CA","CH","PT"]}});
  await admin.from("orders").update({stripe_checkout_session_id:session.id,updated_at:new Date().toISOString()}).eq("id",o.id);
  return Response.json({url:session.url,orderId:o.id,subtotal,discount,total,blackCardDiscount:pct},{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){console.error(e);return Response.json({error:"checkout_failed"},{status:500,headers:cors});}
});