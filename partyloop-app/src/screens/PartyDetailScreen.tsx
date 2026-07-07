import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLiveParties } from '../hooks/useLiveParties';
import type { Party } from '../types';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyDetail'>;

export default function PartyDetailScreen({ route, navigation }: Props) {
  const { partyId } = route.params;
  const { user } = useAuth();
  const [party, setParty] = useState<Party | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ party }, { members }] = await Promise.all([
        api.getParty(partyId),
        api.listMembers(partyId),
      ]);
      setParty(party);
      setIsMember(!!user && members.some((m) => m.id === user.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [partyId, user]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveParties(load);

  const isHost = user && party && party.hostId === user.id;

  const onToggleJoin = async () => {
    if (!party) return;
    setBusy(true);
    setError(null);
    try {
      if (isMember) {
        await api.leaveParty(party.id);
      } else {
        await api.joinParty(party.id);
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!party) return;
    setBusy(true);
    try {
      await api.deleteParty(party.id);
      navigation.goBack();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const onPickPhoto = async () => {
    if (!party) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Нужен доступ к галерее, чтобы выбрать фото');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setBusy(true);
    setError(null);
    try {
      const { party: updated } = await api.uploadPartyPhoto(party.id, {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      setParty(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !party) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ec4899" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      {party.photoUrl ? (
        <Image source={{ uri: party.photoUrl }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={{ color: '#8888a0' }}>Без фото</Text>
        </View>
      )}

      {isHost && (
        <Pressable style={styles.secondaryButton} onPress={onPickPhoto} disabled={busy}>
          <Text style={styles.secondaryButtonText}>
            {party.photoUrl ? 'Заменить фото' : 'Добавить фото'}
          </Text>
        </Pressable>
      )}

      <Text style={styles.title}>{party.title}</Text>
      {party.address && <Text style={styles.meta}>📍 {party.address}</Text>}
      <Text style={styles.meta}>🕒 {new Date(party.startsAt).toLocaleString('ru-RU')}</Text>
      <Text style={styles.meta}>👥 {party.memberCount ?? 0} участников</Text>

      {!!party.description && <Text style={styles.description}>{party.description}</Text>}

      {error && <Text style={styles.error}>{error}</Text>}

      {!isHost && (
        <Pressable style={styles.button} onPress={onToggleJoin} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isMember ? 'Отписаться' : 'Записаться'}</Text>
          )}
        </Pressable>
      )}

      {isHost && (
        <Pressable style={styles.dangerButton} onPress={onDelete} disabled={busy}>
          <Text style={styles.buttonText}>Удалить вечеринку</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15121f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#15121f' },
  photo: { width: '100%', height: 200, borderRadius: 16, marginBottom: 12 },
  photoPlaceholder: {
    backgroundColor: '#221e33',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#332d4d',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 8 },
  meta: { color: '#a29bd6', fontSize: 14, marginTop: 6 },
  description: { color: '#d4d0e8', fontSize: 15, marginTop: 16, lineHeight: 21 },
  error: { color: '#f87171', marginTop: 16, textAlign: 'center' },
  button: {
    backgroundColor: '#ec4899',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  dangerButton: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#332d4d',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: { color: '#fff', fontSize: 14 },
});
