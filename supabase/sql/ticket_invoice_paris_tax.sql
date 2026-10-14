-- Vanessa confirmed JD Events is non-assujettie à la TVA, 14 October 2026.
-- Do not infer a tax-code article (e.g. 293 B) from association status.
alter function public.protect_ticket_invoice() set search_path=public;
update public.ticket_invoice_issuers set vat_rate_bps=0,vat_number=null,
 exemption_note='TVA non applicable — association non assujettie à la TVA.'
where event_id='eb0025ca-b597-4708-9d47-b24ebbf507b5';
