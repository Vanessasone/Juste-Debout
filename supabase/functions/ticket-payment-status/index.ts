import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.1";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  if (req.method !== "POST") return Response.json({error:"method_not_allowed"},{status:405,headers:cors});
  try {
    const {sessionId} = await req.json();
    // Identifiant Stripe opaque : retourne seulement le statut, jamais l'e-mail, les billets ou le QR.
    if (typeof sessionId !== "string" || !/^cs_(live|test)_[a-zA-Z0-9]{20,}$/.test(sessionId))
      return Response.json({error:"invalid_session"},{status:400,headers:cors});
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const {data,error}=await admin.from("ticket_orders").select("status").eq("stripe_checkout_session_id",sessionId).maybeSingle();
    if(error) return Response.json({error:"status_unavailable"},{status:503,headers:cors});
    return Response.json({status:data?.status??"unknown"},{headers:cors});
  } catch { return Response.json({error:"status_unavailable"},{status:400,headers:cors}); }
});
