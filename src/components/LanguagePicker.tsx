import { useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import { LANGUAGES, useI18n } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
export function LanguagePicker() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const c = useColors();
  const current = LANGUAGES.find(l => l.code === locale) ?? LANGUAGES[1];
  return <View style={{ marginBottom: 12 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={current.label} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 12 }}>
      <Text style={{ color: c.text, fontSize: 16 }}>🌐 {current.label} ▾</Text>
    </Pressable>
    {open && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 10 }}>
      {LANGUAGES.map(l => <Pressable key={l.code} accessibilityRole="button" accessibilityState={{ selected: locale === l.code }} onPress={() => { void setLocale(l.code); setOpen(false); }} style={{ minHeight: 44, justifyContent: 'center', padding: 10, backgroundColor: locale === l.code ? c.accent : c.surface, borderRadius: 10 }}><Text style={{ color: locale === l.code ? '#101010' : c.text, fontSize: 16 }}>{l.label}</Text></Pressable>)}
    </View>}
  </View>;
}
