import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedJustNow, setSavedJustNow] = useState(false);

  const nameChanged = displayName.trim() !== (user?.displayName ?? '') && displayName.trim().length >= 2;

  const onPickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Нужен доступ к галерее, чтобы выбрать фото');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setBusy(true);
    setError(null);
    try {
      await api.uploadAvatar({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      await refreshUser();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onSaveName = async () => {
    setBusy(true);
    setError(null);
    setSavedJustNow(false);
    try {
      await api.updateProfile(displayName.trim());
      await refreshUser();
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.avatarWrap}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {user.displayName.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <Pressable onPress={onPickAvatar} disabled={busy}>
          <Text style={styles.changeAvatar}>Сменить фото</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Имя</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Твоё имя"
        placeholderTextColor="#8888a0"
      />

      <Text style={styles.label}>Email</Text>
      <View style={[styles.input, styles.inputDisabled]}>
        <Text style={styles.inputDisabledText}>{user.email}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {savedJustNow && <Text style={styles.success}>Сохранено ✓</Text>}

      <Pressable
        style={[styles.button, !nameChanged && styles.buttonDisabled]}
        onPress={onSaveName}
        disabled={busy || !nameChanged}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Сохранить</Text>}
      </Pressable>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#15121f' },
  avatarWrap: { alignItems: 'center', marginBottom: 28 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 10 },
  avatarPlaceholder: {
    backgroundColor: '#221e33',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#332d4d',
  },
  avatarInitial: { color: '#a29bd6', fontSize: 36, fontWeight: '700' },
  changeAvatar: { color: '#ec4899', fontSize: 14, fontWeight: '600' },
  label: { color: '#a29bd6', fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#221e33',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#332d4d',
  },
  inputDisabled: { opacity: 0.6 },
  inputDisabledText: { color: '#a29bd6' },
  error: { color: '#f87171', marginTop: 16, textAlign: 'center' },
  success: { color: '#4ade80', marginTop: 16, textAlign: 'center' },
  button: {
    backgroundColor: '#ec4899',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  logoutText: { color: '#f87171', fontWeight: '600', fontSize: 15 },
});