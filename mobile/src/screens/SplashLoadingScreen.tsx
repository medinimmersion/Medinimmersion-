import React from 'react';
import { View, Text, SafeAreaView, Animated } from 'react-native';

export default function SplashLoadingScreen() {
  const spinValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-purple-50 to-white items-center justify-center">
      <View className="items-center gap-6">
        <Animated.Text
          style={{ transform: [{ rotate: spin }] }}
          className="text-6xl mb-4"
        >
          🕌
        </Animated.Text>

        <Text className="text-2xl font-bold text-gray-900 text-center">
          MédinImmersion
        </Text>
        <Text className="text-base text-gray-600 text-center px-6">
          RIHLA - Your Journey to Arabic Mastery
        </Text>

        <View className="mt-6 w-16 h-1 bg-gray-300 rounded-full overflow-hidden">
          <Animated.View
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
            style={{
              width: '100%',
              transform: [
                {
                  translateX: spinValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-64, 64],
                  }),
                },
              ],
            }}
          />
        </View>

        <Text className="text-xs text-gray-500 mt-6">Loading your journey...</Text>
      </View>
    </SafeAreaView>
  );
}
