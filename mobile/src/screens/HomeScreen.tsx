import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGameState } from '../hooks/useGameState';

export default function HomeScreen({ navigation }) {
  const { userProgress } = useGameState();

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-purple-50 to-white">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Header */}
        <View className="px-6 py-6">
          <Text className="text-3xl font-bold text-gray-900 mb-2">
            أهلا وسهلا
          </Text>
          <Text className="text-base text-gray-600">
            Welcome to MédinImmersion RIHLA
          </Text>
        </View>

        {/* Progress Card */}
        <View className="mx-6 mb-6 bg-white rounded-3xl p-6 shadow-sm">
          <View className="flex-row justify-between items-start mb-4">
            <View>
              <Text className="text-sm text-gray-500 mb-1">Streak</Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-3xl font-bold text-orange-500">
                  {userProgress?.streakDays || 0}
                </Text>
                <Text className="text-2xl">🔥</Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-sm text-gray-500 mb-1">Level</Text>
              <Text className="text-3xl font-bold text-purple-600">
                {userProgress?.currentLevel || 1}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View className="mt-6">
            <View className="flex-row justify-between mb-2">
              <Text className="text-xs font-semibold text-gray-600">
                Letters Mastered
              </Text>
              <Text className="text-xs font-semibold text-purple-600">
                {userProgress?.masteredLetters?.length || 0}/28
              </Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View
                className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                style={{
                  width: `${
                    ((userProgress?.masteredLetters?.length || 0) / 28) * 100
                  }%`,
                }}
              />
            </View>
          </View>

          <View className="mt-4 pt-4 border-t border-gray-200">
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Text className="text-xs text-gray-500 mb-1">Total XP</Text>
                <Text className="font-bold text-gray-900">
                  {userProgress?.totalXP || 0}
                </Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-xs text-gray-500 mb-1">Mastered</Text>
                <Text className="font-bold text-gray-900">
                  {userProgress?.masteredLetters?.length || 0}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mx-6 mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-3">
            Quick Start
          </Text>
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => navigation.navigate('Journey')}
              className="bg-purple-600 rounded-2xl p-4 flex-row items-center gap-4 active:bg-purple-700"
            >
              <Ionicons name="map" size={24} color="white" />
              <View className="flex-1">
                <Text className="text-white font-bold">Journey Map</Text>
                <Text className="text-purple-100 text-xs">
                  Continue learning
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Practice')}
              className="bg-blue-600 rounded-2xl p-4 flex-row items-center gap-4 active:bg-blue-700"
            >
              <Ionicons name="mic" size={24} color="white" />
              <View className="flex-1">
                <Text className="text-white font-bold">
                  Practice Pronunciation
                </Text>
                <Text className="text-blue-100 text-xs">With Kalam AI</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Achievements */}
        {userProgress?.achievements && userProgress.achievements.length > 0 && (
          <View className="mx-6 mb-8">
            <Text className="text-lg font-bold text-gray-900 mb-3">
              Recent Achievements
            </Text>
            <View className="flex-row gap-3">
              {userProgress.achievements.slice(-3).map((achievement, index) => (
                <View
                  key={index}
                  className="flex-1 bg-yellow-50 rounded-2xl p-3 items-center"
                >
                  <Text className="text-2xl mb-1">🏆</Text>
                  <Text className="text-xs font-semibold text-center text-gray-900">
                    {achievement.title}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
