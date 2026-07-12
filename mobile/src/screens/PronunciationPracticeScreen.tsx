import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings } from '../hooks/useAppSettings';

export default function PronunciationPracticeScreen() {
  const { getTheme } = useAppSettings();
  const theme = getTheme();

  return (
    <SafeAreaView style={{ backgroundColor: theme.colors.background }} className="flex-1">
      <View className="flex-1 px-6 items-center justify-center">
        <View
          style={{
            backgroundColor: theme.colors.surface,
          }}
          className="w-24 h-24 rounded-full items-center justify-center mb-6"
        >
          <Ionicons name="mic" size={48} color={theme.colors.primary} />
        </View>
        <Text
          style={{ color: theme.colors.text }}
          className="text-2xl font-bold mb-2 text-center"
        >
          Pronunciation Practice
        </Text>
        <Text
          style={{ color: theme.colors.textSecondary }}
          className="text-base text-center mb-8"
        >
          Use Kalam AI to practice and improve your Arabic pronunciation
        </Text>

        <TouchableOpacity
          style={{ backgroundColor: theme.colors.primary }}
          className="px-8 py-4 rounded-xl mb-4 w-full items-center"
        >
          <Text className="text-white font-bold text-lg">Start Recording</Text>
        </TouchableOpacity>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          }}
          className="mt-8 p-4 rounded-xl border w-full"
        >
          <Text style={{ color: theme.colors.text }} className="font-semibold mb-2">
            💡 Tip:
          </Text>
          <Text style={{ color: theme.colors.textSecondary }} className="text-sm">
            Kalam AI will help you perfect your pronunciation. Speak clearly and
            listen to the feedback to improve.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
