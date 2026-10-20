-- Restore the original Black Card discount, confirmed by Vanessa.
alter table public.black_cards alter column merchandise_discount_percent set default 15;
update public.black_cards set merchandise_discount_percent=15 where merchandise_discount_percent is distinct from 15;
