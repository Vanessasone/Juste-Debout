import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve((req: Request) => {
  const incoming = new URL(req.url);
  const destination = new URL("https://juste-debout-app.vercel.app/shop-success");
  const session = incoming.searchParams.get("session_id");
  if (session) destination.searchParams.set("session_id", session);
  return Response.redirect(destination.toString(), 303);
});
