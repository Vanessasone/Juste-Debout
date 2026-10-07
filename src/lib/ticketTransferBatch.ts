import { supabase } from '@/lib/supabase';

export type ImportedRecipient = { firstName?: string; lastName?: string; email: string };

export function parseRecipientList(raw: string): { valid: ImportedRecipient[]; invalid: string[]; duplicates: string[] } {
  const lines = raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const valid: ImportedRecipient[] = [], invalid: string[] = [], duplicates: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const parts = line.split(/[;,\t]/).map((x) => x.trim());
    const emailIndex = parts.findIndex((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
    if (emailIndex < 0) { invalid.push(line); continue; }
    const email = parts[emailIndex].toLowerCase();
    if (seen.has(email)) { duplicates.push(email); continue; }
    seen.add(email);
    const names = parts.filter((_, i) => i !== emailIndex);
    valid.push({ firstName: names[0] || undefined, lastName: names[1] || undefined, email });
  }
  return { valid, invalid, duplicates };
}

export async function createTransferBatch(tickets: { id: string }[], recipients: ImportedRecipient[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');
  if (recipients.length > tickets.length) throw new Error('too_many_recipients');

  const { data: batch, error: be } = await supabase.from('ticket_transfer_batches').insert({ purchaser_id: user.id }).select('id').single();
  if (be) throw be;

  const invitationLinks: Array<{email:string;link:string}> = [];
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i], ticket = tickets[i];
    const { data, error } = await supabase.rpc('prepare_ticket_transfer', { p_ticket: ticket.id, p_email: r.email });
    const status = !error && data?.ok ? 'prepared' : 'error';
    if (status === 'prepared' && data.token) invitationLinks.push({email:r.email,link:`https://juste-debout-app.vercel.app/claim-ticket?token=${encodeURIComponent(data.token)}`});
    await supabase.from('ticket_transfer_batch_rows').insert({
      batch_id: batch.id, ticket_id: ticket.id, email: r.email,
      holder_name: [r.firstName, r.lastName].filter(Boolean).join(' ') || null,
      status, error: error?.message ?? (!data?.ok ? data?.error : null),
    });
  }
  return { batchId: batch.id as string, invitationLinks };
}
