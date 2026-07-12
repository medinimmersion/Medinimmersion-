import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGameState } from '../hooks/useGameState';
import { useAppSettings } from '../hooks/useAppSettings';

export default function HomeScreen({ navigation }) {
  const { userProgress } = useGameState();
  const { t, getTheme } = useAppSettings();
  const theme = getTheme();

  return (
    <SafeAreaView style={{ backgroundColor: theme.colors.background }} className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Header */}
        <View className="px-6 py-6">
          <Text style={{ color: theme.colors.text }} className="text-3xl font-bold mb-2">
            أهلا وسهلا
          </Text>
          <Text style={{ color: theme.colors.textSecondary }} className="text-base">
            {t('welcome')}
          </Text>
        </View>

        {/* Progress Card */}
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          }}
          className="mx-6 mb-6 rounded-3xl p-6 border"
        >
          <View className="flex-row justify-between items-start mb-4">
            <View>
              <Text style={{ color: theme.colors.textSecondary }} className="text-sm mb-1">
                {t('home_streak')}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text
                  style={{ color: theme.colors.primary }}
                  className="text-3xl font-bold"
                >
                  {userProgress?.streakDays || 0}
                </Text>
                <Text className="text-2xl">🔥</Text>
              </View>
            </View>
            <View className="items-end">
              <Text style={{ color: theme.colors.textSecondary }} className="text-sm mb-1">
                {t('home_level')}
              </Text>
              <Text style={{ color: theme.colors.primary }} className="text-3xl font-bold">
                {userProgress?.currentLevel || 1}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View className="mt-6">
            <View className="flex-row justify-between mb-2">
              <Text style={{ color: theme.colors.text }} className="text-xs font-semibold">
                {t('home_letters_mastered')}
              </Text>
              <Text style={{ color: theme.colors.primary }} className="text-xs font-semibold">
                {userProgress?.masteredLetters?.length || 0}/28
              </Text>
            </View>
            <View
              style={{ backgroundColor: theme.colors.border }}
              className="h-2 rounded-full overflow-hidden"
            >
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  width: `${
                    ((userProgress?.masteredLetters?.length || 0) / 28) * 100
                  }%`,
                }}
              />
            </View>
          </View>

          <View
            style={{ borderTopColor: theme.colors.border }}
            className="mt-4 pt-4 border-t"
          >
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Text style={{ color: theme.colors.textSecondary }} className="text-xs mb-1">
                  {t('home_total_xp')}
                </Text>
                <Text style={{ color: theme.colors.text }} className="font-bold">
                  {userProgress?.totalXP || 0}
                </Text>
              </View>
              <View className="items-center flex-1">
                <Text style={{ color: theme.colors.textSecondary }} className="text-xs mb-1">
                  {t('home_achievements')}
                </Text>
                <Text style={{ color: theme.colors.text }} className="font-bold">
                  {userProgress?.masteredLetters?.length || 0}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mx-6 mb-6">
          <Text style={{ color: theme.colors.text }} className="text-lg font-bold mb-3">
            {t('home_quick_start')}
          </Text>
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => navigation.navigate('Journey')}
              style={{ backgroundColor: theme.colors.primary }}
              className="rounded-2xl p-4 flex-row items-center gap-4"
            >
              <Ionicons name="map" size={24} color="white" />
              <View className="flex-1">
                <Text className="text-white font-bold">{t('home_journey_map')}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)' }} className="text-xs">
                  {t('home_journey_desc')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Practice')}
              style={{ backgroundColor: theme.colors.secondary }}
              className="rounded-2xl p-4 flex-row items-center gap-4"
            >
              <Ionicons name="mic" size={24} color="white" />
              <View className="flex-1">
                <Text className="text-white font-bold">
                  {t('home_pronunciation')}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)' }} className="text-xs">
                  {t('home_pronunciation_desc')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Achievements */}
        {userProgress?.achievements && userProgress.achievements.length > 0 && (
          <View className="mx-6 mb-8">
            <Text style={{ color: theme.colors.text }} className="text-lg font-bold mb-3">
              {t('home_achievements_unlocked')}
            </Text>
            <View className="flex-row gap-3">
              {userProgress.achievements.slice(-3).map((achievement, index) => (
                <View
                  key={index}
                  style={{
                    backgroundColor: theme.colors.accent,
                    borderColor: theme.colors.border,
                  }}
                  className="flex-1 rounded-2xl p-3 items-center border"
                >
                  <Text className="text-2xl mb-1">🏆</Text>
                  <Text
                    style={{ color: theme.colors.text }}
                    className="text-xs font-semibold text-center"
                  >
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
