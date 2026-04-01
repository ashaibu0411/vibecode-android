import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { UserPlus, LogIn, Eye, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useStore } from '@/lib/store';

export default function AuthChoiceScreen() {
  const selectedLocation = useStore((s) => s.selectedLocation);
  const setIsGuest = useStore((s) => s.setIsGuest);
  const setIsOnboarded = useStore((s) => s.setIsOnboarded);
  const setForceLoginOnLaunch = useStore((s) => s.setForceLoginOnLaunch);

  const city = selectedLocation?.city || '';
  const country = selectedLocation?.country || '';

  const goGuest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setForceLoginOnLaunch(false);
    setIsGuest(true);
    setIsOnboarded(true);
    router.replace('/' as any);
  };

  const goSignup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForceLoginOnLaunch(false);
    router.push('/signup?mode=signup' as any);
  };

  const goSignin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForceLoginOnLaunch(false);
    router.push('/signup?mode=signin' as any);
  };

  return (
    <View className="flex-1 bg-cream">
      <SafeAreaView edges={['top']} className="flex-1 px-5">
        <View className="mt-8">
          <Text className="text-3xl font-extrabold text-warmBrown">You’re in.</Text>
          <Text className="text-gray-600 mt-2 text-base">
            Continue as a guest or sign in to unlock posting, messaging, and connections.
          </Text>

          {(city || country) && (
            <View className="flex-row items-center mt-4 bg-white rounded-2xl px-4 py-3 border border-gray-100">
              <MapPin size={18} color="#D4673A" />
              <Text className="ml-2 text-warmBrown font-semibold">
                {city ? city : 'Your community'}{country ? `, ${country}` : ''}
              </Text>
            </View>
          )}
        </View>

        <View className="mt-8 gap-3">
          <Pressable onPress={goSignin} className="active:opacity-90">
            <LinearGradient
              colors={['#1B4D3E', '#2D6A4F'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16 }}
            >
              <View className="flex-row items-center justify-center">
                <LogIn size={18} color="#FFFFFF" />
                <Text className="text-white font-extrabold ml-2 text-base">Log in</Text>
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={goSignup} className="active:opacity-90">
            <LinearGradient
              colors={['#D4673A', '#B85430'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16 }}
            >
              <View className="flex-row items-center justify-center">
                <UserPlus size={18} color="#FFFFFF" />
                <Text className="text-white font-extrabold ml-2 text-base">Sign up</Text>
              </View>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={goGuest} className="active:opacity-80">
            <View className="bg-white border border-gray-200 rounded-2xl py-4 items-center justify-center flex-row">
              <Eye size={18} color="#8B7355" />
              <Text className="text-warmBrown font-semibold ml-2">Continue as guest</Text>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

