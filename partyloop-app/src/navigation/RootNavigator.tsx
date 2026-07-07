import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import PartiesScreen from '../screens/PartiesScreen';
import CreatePartyScreen from '../screens/CreatePartyScreen';
import PartyDetailScreen from '../screens/PartyDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Parties: undefined;
  CreateParty: undefined;
  PartyDetail: { partyId: string };
  Profile: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: '#15121f', card: '#1e1a2e', border: '#2c2640' },
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1e1a2e' },
        headerTintColor: '#fff',
        headerTitleStyle: { color: '#fff' },
      }}
    >
      <AppStack.Screen name="Parties" component={PartiesScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="CreateParty" component={CreatePartyScreen} options={{ title: 'Новая вечеринка' }} />
      <AppStack.Screen name="PartyDetail" component={PartyDetailScreen} options={{ title: 'Вечеринка' }} />
      <AppStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </AppStack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#15121f' }}>
        <ActivityIndicator color="#ec4899" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
