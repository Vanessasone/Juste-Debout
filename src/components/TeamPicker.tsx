/**
 * Sélecteur d'équipe — choisir une équipe déjà mémorisée, ou en créer une nouvelle
 * (nom + pays + photo). Les équipes se réutilisent d'une présélection à la finale.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { CountryPicker } from '@/components/CountryPicker';
import { T } from '@/components/ui';
import { Palette, Radius, Space } from '@/constants/brand';
import { pickImage, uploadTeamPhoto } from '@/lib/photos';
import { createTeam, getTeams, Team, updateTeam } from '@/lib/teams';
import { flagEmoji } from '@/lib/vote';

export function TeamPicker({
  value,
  onSelect,
  color = Palette.primary,
  placeholder = 'Choisir une équipe',
}: {
  value: Team | null;
  onSelect: (team: Team) => void;
  color?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [nName, setNName] = useState('');
  const [nCountry, setNCountry] = useState('');
  const [nPhoto, setNPhoto] = useState<string | null>(null); // base64
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = () => {
    setOpen(true);
    setLoading(true);
    getTeams()
      .then(setTeams)
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  };

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? teams.filter((t) => t.name.toLowerCase().includes(s)) : teams;
  }, [q, teams]);

  const choose = (t: Team) => {
    onSelect(t);
    setOpen(false);
    setShowNew(false);
    setQ('');
  };

  const addPhoto = async (source: 'camera' | 'library') => {
    try {
      const b64 = await pickImage(source);
      if (b64) setNPhoto(b64);
    } catch (e: any) {
      setError(e?.message ?? 'Photo impossible.');
    }
  };

  const createAndSelect = async () => {
    if (!nName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let team = await createTeam({ name: nName.trim(), country: nCountry || null });
      if (nPhoto) {
        const url = await uploadTeamPhoto(team.id, nPhoto);
        await updateTeam(team.id, { photo_url: url });
        team = { ...team, photo_url: url };
      }
      setNName('');
      setNCountry('');
      setNPhoto(null);
      setShowNew(false);
      choose(team);
    } catch (e: any) {
      setError(e?.message ?? 'Création impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable onPress={openModal} style={[styles.trigger, { borderColor: color }]}>
        {value?.photo_url ? (
          <Image source={{ uri: value.photo_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Ionicons name="people" size={18} color={color} />
          </View>
        )}
        <T variant="small" color={value ? Palette.text : Palette.textMute} numberOfLines={1} style={{ flex: 1 }}>
          {value ? `${flagEmoji(value.country)} ${value.name}` : placeholder}
        </T>
        <Ionicons name="chevron-down" size={16} color={Palette.textMute} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.head}>
              <T variant="h2">Équipes</T>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            {/* Nouvelle équipe */}
            {showNew ? (
              <View style={styles.newBox}>
                <TextInput
                  value={nName}
                  onChangeText={setNName}
                  placeholder="Nom de l'équipe (ex. Zoo & Ayoka)"
                  placeholderTextColor={Palette.textMute}
                  style={styles.input}
                />
                <View style={{ marginTop: Space.sm }}>
                  <CountryPicker value={nCountry} onChange={setNCountry} placeholder="Pays de l'équipe" />
                </View>
                <View style={styles.photoRow}>
                  {nPhoto ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${nPhoto}` }} style={styles.newThumb} />
                  ) : (
                    <View style={[styles.newThumb, styles.thumbEmpty]}>
                      <Ionicons name="people" size={22} color={Palette.textMute} />
                    </View>
                  )}
                  <Pressable onPress={() => addPhoto('camera')} style={styles.photoBtn}>
                    <Ionicons name="camera" size={16} color={Palette.primary} />
                  </Pressable>
                  <Pressable onPress={() => addPhoto('library')} style={styles.photoBtn}>
                    <Ionicons name="images" size={16} color={Palette.primary} />
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  <Pressable
                    onPress={createAndSelect}
                    disabled={saving || !nName.trim()}
                    style={[styles.createBtn, (saving || !nName.trim()) && { opacity: 0.4 }]}>
                    {saving ? (
                      <ActivityIndicator color={Palette.black} size="small" />
                    ) : (
                      <T variant="label" color={Palette.black}>
                        Créer
                      </T>
                    )}
                  </Pressable>
                </View>
                {error && (
                  <T variant="small" color={Palette.danger} style={{ marginTop: 6 }}>
                    {error}
                  </T>
                )}
              </View>
            ) : (
              <Pressable onPress={() => setShowNew(true)} style={styles.newTrigger}>
                <Ionicons name="add-circle" size={18} color={Palette.primary} />
                <T variant="label" color={Palette.primary} style={{ marginLeft: 6 }}>
                  Nouvelle équipe
                </T>
              </Pressable>
            )}

            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher une équipe…"
              placeholderTextColor={Palette.textMute}
              style={[styles.input, { marginTop: Space.md }]}
            />

            {loading ? (
              <ActivityIndicator color={Palette.primary} style={{ marginTop: Space.lg }} />
            ) : (
              <FlatList
                data={list}
                keyExtractor={(t) => t.id}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 340, marginTop: Space.sm }}
                ListEmptyComponent={
                  <T variant="small" color={Palette.textMute} style={{ paddingVertical: Space.md }}>
                    Aucune équipe encore. Crée-en une ci-dessus.
                  </T>
                }
                renderItem={({ item }) => (
                  <Pressable onPress={() => choose(item)} style={styles.row}>
                    {item.photo_url ? (
                      <Image source={{ uri: item.photo_url }} style={styles.rowThumb} />
                    ) : (
                      <View style={[styles.rowThumb, styles.thumbEmpty]}>
                        <Ionicons name="people" size={16} color={Palette.textMute} />
                      </View>
                    )}
                    <T variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                      {flagEmoji(item.country)} {item.name}
                    </T>
                    <Ionicons name="chevron-forward" size={16} color={Palette.textMute} />
                  </Pressable>
                )}
              />
            )}
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
    gap: 8,
    backgroundColor: Palette.surface2,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  thumb: { width: 30, height: 30, borderRadius: 15 },
  thumbEmpty: { backgroundColor: Palette.surface3, alignItems: 'center', justifyContent: 'center' },
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
  input: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Palette.text,
    fontSize: 15,
  },
  newTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 11,
  },
  newBox: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Space.md,
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Space.sm },
  newThumb: { width: 44, height: 44, borderRadius: 10 },
  photoBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtn: { backgroundColor: Palette.primary, borderRadius: Radius.pill, paddingVertical: 10, paddingHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6 },
  rowThumb: { width: 40, height: 40, borderRadius: 20 },
});
