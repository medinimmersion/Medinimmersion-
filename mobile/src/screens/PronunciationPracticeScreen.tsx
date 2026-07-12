import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PronunciationPracticeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 items-center justify-center">
        <View className="w-24 h-24 rounded-full bg-blue-100 items-center justify-center mb-6">
          <Ionicons name="mic" size={48} color="#3B82F6" />
        </View>
        <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Pronunciation Practice
        </Text>
        <Text className="text-base text-gray-600 text-center mb-8">
          Use Kalam AI to practice and improve your Arabic pronunciation
        </Text>

        <TouchableOpacity className="bg-blue-600 px-8 py-4 rounded-xl mb-4 w-full items-center">
          <Text className="text-white font-bold text-lg">Start Recording</Text>
        </TouchableOpacity>

        <View className="mt-8 bg-blue-50 p-4 rounded-xl border border-blue-200 w-full">
          <Text className="font-semibold text-gray-800 mb-2">💡 Tip:</Text>
          <Text className="text-sm text-gray-600">
            Kalam AI will help you perfect your pronunciation. Speak clearly and
            listen to the feedback to improve.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
