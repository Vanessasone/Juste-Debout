/**
 * Boutique — produits officiels Juste Debout (source : shop JD ADN).
 */
import { supabase } from '@/lib/supabase';

export type Product = {
  id: string;
  name: string;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  product_url: string | null;
  sold_out: boolean;
  internal_test?: boolean;
};

export async function getProducts(includeInternalTest = false): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('id,name,price,currency,image_url,product_url,sold_out,sort_order,created_at,internal_test')
    .order('sold_out', { ascending: true })
    .order('sort_order', { ascending: true });
  if (!includeInternalTest) query = query.eq('internal_test', false);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

export function formatPrice(p: Product): string {
  if (p.price == null) return '';
  const n = Number.isInteger(p.price) ? `${p.price}` : p.price.toFixed(2);
  if (p.currency === 'USD') return `$${n}`;
  if (p.currency === 'EUR') return `${n} €`;
  return `${n}${p.currency ? ' ' + p.currency : ''}`;
}
