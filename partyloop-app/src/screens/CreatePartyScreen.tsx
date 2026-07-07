import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { api } from '../api/client';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateParty'>;

export default function CreatePartyScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  // startsAt как локальная строка "YYYY-MM-DDTHH:mm" — проще редактировать руками,
  // на сабмите конвертируем в ISO
  const [startsAt, setStartsAt] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
      setLocating(false);
    })();
  }, []);

  const onSubmit = async () => {
    setError(null);

    if (!title.trim()) return setError('Укажи название');
    if (!coords) return setError('Не удалось определить координаты — разреши геолокацию');
    if (!startsAt) return setError('Укажи дату и время в формате ГГГГ-ММ-ДД ЧЧ:ММ');

    const isoStartsAt = new Date(startsAt.replace(' ', 'T')).toISOString();
    if (isNaN(new Date(isoStartsAt).getTime())) return setError('Не получилось разобрать дату/время');

    setSubmitting(true);
    try {
      await api.createParty({
        title: title.trim(),
        description: description.trim() || undefined,
        address: address.trim() || undefined,
        lat: coords.lat,
        lng: coords.lng,
        startsAt: isoStartsAt,
      });
      navigation.goBack();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Новая вечеринка</Text>

      <Text style={styles.label}>Название</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Движуха на районе" placeholderTextColor="#8888a0" />

      <Text style={styles.label}>Описание</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Приходи, будет весело"
        placeholderTextColor="#8888a0"
        multiline
      />

      <Text style={styles.label}>Адрес</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Необязательно" placeholderTextColor="#8888a0" />

      <Text style={styles.label}>Дата и время (ГГГГ-ММ-ДД ЧЧ:ММ)</Text>
      <TextInput
        style={styles.input}
        value={startsAt}
        onChangeText={setStartsAt}
        placeholder="2026-08-01 20:00"
        placeholderTextColor="#8888a0"
      />

      <Text style={styles.location}>
        {locating
          ? '📍 Определяем твоё местоположение…'
          : coords
          ? `📍 Координаты: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
          : '📍 Геолокация недоступна — разреши доступ в настройках'}
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={onSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Создать</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15121f' },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 20 },
  label: { color: '#a29bd6', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#221e33',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#332d4d',
  },
  textArea: { height: 90, textAlignVertical: 'top' },
  location: { color: '#8888a0', fontSize: 13, marginTop: 16 },
  error: { color: '#f87171', marginTop: 12, textAlign: 'center' },
  button: {
    backgroundColor: '#ec4899',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
