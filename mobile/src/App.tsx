import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useGameState } from './hooks/useGameState';
import HomeScreen from './screens/HomeScreen';
import JourneyMapScreen from './screens/JourneyMapScreen';
import LetterLessonScreen from './screens/LetterLessonScreen';
import PronunciationPracticeScreen from './screens/PronunciationPracticeScreen';
import SettingsScreen from './screens/SettingsScreen';
import SplashLoadingScreen from './screens/SplashLoadingScreen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="HomeTab" component={HomeScreen} />
      <Stack.Screen name="LetterLesson" component={LetterLessonScreen} />
    </Stack.Navigator>
  );
}

function JourneyStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="JourneyTab" component={JourneyMapScreen} />
      <Stack.Screen name="LetterLesson" component={LetterLessonScreen} />
    </Stack.Navigator>
  );
}

function PracticeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="PracticeTab" component={PronunciationPracticeScreen} />
    </Stack.Navigator>
  );
}

function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#F9FAFB',
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 8,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Journey') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Practice') {
            iconName = focused ? 'mic' : 'mic-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 4,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Journey"
        component={JourneyStack}
        options={{ title: 'Journey' }}
      />
      <Tab.Screen
        name="Practice"
        component={PracticeStack}
        options={{ title: 'Practice' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const { isLoading, initializeGame } = useGameState();

  useEffect(() => {
    async function prepare() {
      try {
        // Load custom fonts
        await Font.loadAsync({
          'Amiri': require('../assets/fonts/Amiri-Regular.ttf'),
          'Amiri-Bold': require('../assets/fonts/Amiri-Bold.ttf'),
        });

        // Initialize game state
        initializeGame();
      } catch (e) {
        console.warn(e);
      } finally {
        // Hide splash screen
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (isLoading) {
    return <SplashLoadingScreen />;
  }

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <RootTabs />
      </NavigationContainer>
    </>
  );
}
