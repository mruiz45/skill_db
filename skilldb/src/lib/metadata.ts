import { supabase } from '@/lib/supabase';

export interface MetadataOption {
  item_key: string;
  value: string;
  // sort_order is not strictly needed in MetadataOption if only used for fetching
}

// TODO: Implement dynamic language selection logic (e.g., from context, i18n library)
const getCurrentLanguageSuffix = (): 'fr' | 'en' | 'nl' => 'fr'; // More specific return type

// Define a type for the raw data fetched from Supabase
interface RawMetadataItem {
  item_key: string;
  sort_order: number;
  value_fr?: string | null;
  value_en?: string | null;
  value_nl?: string | null;
}

export const fetchMetadata = async (
  category: string,
  parentItemKey?: string | null
): Promise<MetadataOption[]> => {
  const langSuffix = getCurrentLanguageSuffix();
  const valueColumnName = `value_${langSuffix}` as keyof RawMetadataItem;

  let query = supabase
    .from('metadata')
    // Select all potential value columns and key/sort_order
    .select(`item_key, value_fr, value_en, value_nl, sort_order`)
    .eq('category', category);

  if (parentItemKey) {
    query = query.eq('parent_item_key', parentItemKey);
  }
  query = query.order('sort_order');

  const { data, error } = await query.returns<RawMetadataItem[]>(); // Specify return type

  if (error) {
    console.error(`Error fetching metadata for category "${category}":`, error);
    return [];
  }

  return data ? data.map(item => ({
    item_key: item.item_key,
    value: String(item[valueColumnName] || item.item_key),
  })) : [];
}; 