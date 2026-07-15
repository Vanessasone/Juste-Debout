/**
 * Sélecteur de pays — un bouton qui ouvre une liste recherchable.
 * Stocke le code ISO ; affiche « 🇫🇷 France ». Plus besoin de connaître les codes.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { T } from '@/components/ui';
import { COUNTRIES, countryName } from '@/constants/countries';
import { Palette, Radius, Space } from '@/constants/brand';
import { flagEmoji } from '@/lib/vote';

export function CountryPicker({
  value,
  onChange,
  placeholder = 'Pays',
  compact,
}: {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s));
  }, [q]);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.trigger, compact && { paddingVertical: 9 }]}>
        <T variant="small" color={value ? Palette.text : Palette.textMute} numberOfLines={1} style={{ flex: 1 }}>
          {value ? `${flagEmoji(value)} ${compact ? value : countryName(value)}` : placeholder}
        </T>
        <Ionicons name="chevron-down" size={16} color={Palette.textMute} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.head}>
              <T variant="h2">Choisir un pays</T>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher un pays…"
              placeholderTextColor={Palette.textMute}
              style={styles.search}
              autoCorrect={false}
            />
            <FlatList
              data={list}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.code);
                    setQ('');
                    setOpen(false);
                  }}
                  style={[styles.row, value === item.code && { backgroundColor: Palette.surface2 }]}>
                  <T variant="h3" style={{ flex: 1 }}>
                    {flagEmoji(item.code)}  {item.name}
                  </T>
                  <T variant="caption" color={Palette.textMute}>
                    {item.code}
                  </T>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surface2,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Palette.bgElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.md },
  search: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Palette.text,
    fontSize: 15,
    marginBottom: Space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
  },
});
