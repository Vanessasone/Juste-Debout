-- Apply only after send-ticket-invoices is deployed. Uses the existing private
-- dispatch secret, not a service-role key. One PDF per invocation, six per minute.
select cron.schedule('jd-ticket-invoice-dispatch','10 seconds',$job$
 select net.http_post(
  url:='https://ednymjqqcfrmpawebgrt.supabase.co/functions/v1/send-ticket-invoices',
  headers:=jsonb_build_object('Content-Type','application/json','x-jd-dispatch-token',public.jd_email_dispatch_secret()),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$job$);
