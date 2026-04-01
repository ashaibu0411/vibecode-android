import React, { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Home, Calendar, PlusSquare, User, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';

export default function TabLayout() {
  const currentUserAvatar = useStore((s) => s.currentUser?.avatar);
  const currentUser = useStore((s) => s.currentUser);
  const isGuest = useStore((s) => s.isGuest);
  const forceLoginOnLaunch = useStore((s) => s.forceLoginOnLaunch);

  useEffect(() => {
    if (!forceLoginOnLaunch) return;
    if (currentUser || isGuest) return;
    router.replace('/signup?mode=signin' as any);
  }, [forceLoginOnLaunch, currentUser, isGuest]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FAF7F2',
          borderTopWidth: 1,
          borderTopColor: '#EDE8E0',
          height: 85,
          paddingTop: 10,
          paddingBottom: 25,
        },
        tabBarActiveTintColor: '#D4673A',
        tabBarInactiveTintColor: '#8B7355',
        tabBarShowLabel: false,
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View className={`items-center justify-center ${focused ? 'scale-110' : ''}`}>
              <Home size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View className={`items-center justify-center ${focused ? 'scale-110' : ''}`}>
              <Calendar size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View className={`items-center justify-center ${focused ? 'scale-110' : ''}`}>
              <Users size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View className={`items-center justify-center ${focused ? 'scale-110' : ''}`}>
              <PlusSquare size={28} color={focused ? '#D4673A' : color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View className={`items-center justify-center ${focused ? 'scale-110' : ''}`}>
              {currentUserAvatar ? (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderWidth: focused ? 2 : 1.5,
                    borderColor: focused ? '#D4673A' : color,
                    overflow: 'hidden',
                  }}
                >
                  <Image
                    source={{ uri: currentUserAvatar }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                </View>
              ) : (
                <User size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
              )}
            </View>
          ),
        }}
      />
      {/* Hidden tabs - still accessible via navigation but not shown in tab bar */}
      <Tabs.Screen
        name="search"
        options={{
          href: null, // Hides from tab bar
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null, // Hides from tab bar
        }}
      />
    </Tabs>
  );
}
