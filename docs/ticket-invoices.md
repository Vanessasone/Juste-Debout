# Automatic ticket invoices

After a verified Stripe ticket payment, an independent job creates one numbered,
paid PDF invoice per order, stores it in private Storage and emails it as an
attachment. The buyer can also download it from Wallet → My invoices. Guest
purchases use the same email recovery already implemented for tickets; transfer
recipients never acquire the buyer's invoice.

## Activation prerequisite

The Paris issuer is seeded **disabled** with JD Events' verified address and
SIRET. Before activation, obtain the applicable ticket VAT rate and VAT number,
or the exact legal exemption wording from the organizer/accountant. Neither
association status nor a different JD Gold offer proves the ticket VAT regime.
Then set `vat_rate_bps` (basis points), `vat_number` or `exemption_note`, and
`enabled=true` in `ticket_invoice_issuers`. The database rejects enabled settings
without this information. Confirm whether all ticket products share that rate;
the initial implementation supports one confirmed ticket rate per event.

The dedicated series starts at `JD-BIL-YYYY-000001` each calendar year in Paris
time. Confirm this new ticket series with accounting before activation. Other
events need their own verified issuer row; they are never billed as JD Events
automatically. Settings apply to future issuance only, never existing invoices.

## Deployment order

1. Apply `supabase/sql/ticket_invoices.sql`.
2. Deploy both checkout functions, `stripe-ticket-webhook`,
   `download-ticket-invoice` and `send-ticket-invoices`. Include `_shared` files
   when deploying the invoice worker. It uses the existing Resend billetterie
   key and `jd_email_dispatch_secret`; disable gateway JWT verification for its
   custom secret authentication, for the Stripe webhook and for guest checkout.
   Downloads authenticate the caller and verify order ownership internally.
3. Apply `supabase/sql/ticket_invoice_dispatch.sql` after checking `pg_cron` and
   `pg_net` exist. It sends a worker request every 10 seconds. Ticket confirmation
   emails remain independent.
4. Deploy the app. Confirm issuer tax settings and accounting series, then enable
   its row. Exercise a Stripe **test-mode** paid checkout and inspect the PDF,
   attachment, private download, duplicate webhook and a failed email retry.

No historical order backfill is run by this migration. Sessions created before
the new checkout may lack a billing address/name; their queued jobs wait for
verified missing details instead of emitting incomplete invoices. New Checkout
sessions require billing identity and address. No extra Stripe invoice fee or
automatic tax collection is enabled by this change.

## Reliability and privacy

Transactional row locks allocate a unique number and freeze the issuer, buyer,
event, order items, discount and paid total. PDF generation or email failures
reuse that same invoice. A five-minute lease recovers interrupted workers;
retries back off up to one hour and are never silently discarded. Resend's
idempotency key is stable per invoice; a stored provider ID prevents resending
completed jobs. Downloads expire after 60 seconds and PDFs are not public.

Refunds do not rewrite or delete the original invoice. Automatic credit notes
are outside this change and must be handled by accounting. The worker supports
six invoices/minute; increase scheduling/concurrency after measuring a sales
peak. Fonts are pinned by source commit and SHA-256, cached per worker, under
the SIL Open Font License. Latin fonts are small; CJK fonts are fetched only
when needed. Font/download failures retry without blocking ticket delivery.

## Local checks

`scripts/test-ticket-invoices.mjs` runs against isolated PGlite, never production
orders. Install the pinned test dependencies as shown in its header and download
the two pinned font URLs listed in `_shared/ticket-invoices.ts` to
`/tmp/jd-invoice-font-latin.ttf` and `/tmp/jd-invoice-font-full.ttf`. It verifies
tax gating, numbering, lease retries, snapshot immutability, refunded invoice
retention, buyer-only RLS, discount/VAT sums, Unicode and multi-page PDFs, and
the actual email attachment/idempotency and email-failure retry paths. PDFs in
`/tmp/jd-invoice-*.pdf` are test documents with no accounting value.
