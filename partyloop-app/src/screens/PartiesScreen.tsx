import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLiveParties } from '../hooks/useLiveParties';
import type { Party } from '../types';

type Props = NativeStackScreenProps<AppStackParamList, 'Parties'>;

export default function PartiesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearMe, setNearMe] = useState(false);

  const load = useCallback(async (useLocation: boolean) => {
    try {
      if (useLocation) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          const { parties } = await api.findPartiesNear(
            pos.coords.latitude,
            pos.coords.longitude,
            10
          );
          setParties(parties);
          setNearMe(true);
          return;
        }
      }
      const { parties } = await api.listParties();
      setParties(parties);
      setNearMe(false);
    } catch (err) {
      console.warn('Не удалось загрузить вечеринки:', (err as Error).message);
    }
  }, []);

  useEffect(() => {
    load(false).finally(() => setLoading(false));
  }, [load]);

  // Автообновление списка на любое party:new / party:updated / party:deleted
  useLiveParties(() => load(nearMe));

  const onRefresh = async () => {
    setRefreshing(true);
    await load(nearMe);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ec4899" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🎉 partyloop</Text>
          <Text style={styles.headerSubtitle}>Привет, {user?.displayName}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Profile')}>
  {user?.avatarUrl ? (
    <Image source={{ uri: user.avatarUrl }} style={styles.headerAvatar} />
  ) : (
    <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
      <Text style={styles.headerAvatarInitial}>
        {user?.displayName.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  )}
</Pressable>
      </View>

      <View style={styles.toolbar}>
        <Pressable
          style={[styles.filterChip, !nearMe && styles.filterChipActive]}
          onPress={() => load(false)}
        >
          <Text style={styles.filterChipText}>Все</Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, nearMe && styles.filterChipActive]}
          onPress={() => load(true)}
        >
          <Text style={styles.filterChipText}>Рядом со мной</Text>
        </Pressable>
      </View>

            <FlatList
        data={parties}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />}
        ListEmptyComponent={
          <Text style={styles.empty}>Пока вечеринок нет — создай первую!</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('PartyDetail', { partyId: item.id })}
          >
            {item.photoUrl && <Image source={{ uri: item.photoUrl }} style={styles.cardImage} />}
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.address && <Text style={styles.cardMeta}>📍 {item.address}</Text>}
            <Text style={styles.cardMeta}>
              🕒 {new Date(item.startsAt).toLocaleString('ru-RU')}
            </Text>
            <Text style={styles.cardMeta}>👥 {item.memberCount ?? 0} участников</Text>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('CreateParty')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15121f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#15121f' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 24,
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
headerAvatarPlaceholder: {
  backgroundColor: '#221e33',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#332d4d',
},
headerAvatarInitial: { color: '#a29bd6', fontSize: 16, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: '#a29bd6', fontSize: 13 },
  toolbar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  filterChip: {
    borderWidth: 1,
    borderColor: '#332d4d',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  filterChipActive: { backgroundColor: '#332145', borderColor: '#ec4899' },
  filterChipText: { color: '#fff', fontSize: 13 },
  empty: { color: '#8888a0', textAlign: 'center', marginTop: 48 },
  card: {
    backgroundColor: '#1e1a2e',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2c2640',
  },
  cardImage: { width: '100%', height: 140, borderRadius: 12, marginBottom: 10 },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  cardMeta: { color: '#a29bd6', fontSize: 13, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ec4899',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
});
