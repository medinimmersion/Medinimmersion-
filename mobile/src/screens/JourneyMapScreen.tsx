import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGameState } from '../hooks/useGameState';
import { useAppSettings } from '../hooks/useAppSettings';
import { Phase } from '../types';

const PHASES: { id: Phase; emoji: string; name: string; arabicName: string }[] =
  [
    { id: 'MEDINA', emoji: '🕌', name: 'Medina', arabicName: 'المدينة' },
    { id: 'MECCA', emoji: '🌙', name: 'Mecca', arabicName: 'مكة' },
    { id: 'EGYPT', emoji: '🦁', name: 'Egypt', arabicName: 'مصر' },
    { id: 'MOROCCO', emoji: '🏜️', name: 'Morocco', arabicName: 'المغرب' },
    { id: 'DUBAI', emoji: '🏙️', name: 'Dubai', arabicName: 'دبي' },
    {
      id: 'JERUSALEM',
      emoji: '🏛️',
      name: 'Jerusalem',
      arabicName: 'القدس',
    },
  ];

export default function JourneyMapScreen({ navigation }) {
  const { letters, userProgress } = useGameState();
  const { getTheme } = useAppSettings();
  const theme = getTheme();
  const [selectedPhase, setSelectedPhase] = useState<Phase>('MEDINA');

  const currentPhaseConfig = PHASES.find((p) => p.id === selectedPhase);
  const phaseLetters = letters.filter((l) => l.phase === selectedPhase);

  const handleLetterPress = (letterId: string) => {
    navigation.navigate('LetterLesson', { letterId });
  };

  const getLetterStatus = (letterId: string) => {
    if (userProgress?.masteredLetters?.includes(letterId)) {
      return 'mastered';
    }
    if (userProgress?.completedLetters?.includes(letterId)) {
      return 'completed';
    }
    return 'new';
  };

  return (
    <SafeAreaView style={{ backgroundColor: theme.colors.background }} className="flex-1">
      {/* Phase Carousel */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-4">
        <View className="pl-6 pr-4 flex-row gap-3">
          {PHASES.map((phase) => (
            <TouchableOpacity
              key={phase.id}
              onPress={() => setSelectedPhase(phase.id)}
              style={{
                backgroundColor:
                  selectedPhase === phase.id
                    ? theme.colors.primary
                    : theme.colors.surface,
              }}
              className="px-6 py-3 rounded-full justify-center items-center"
            >
              <Text className="text-xl mb-1">{phase.emoji}</Text>
              <Text
                style={{
                  color:
                    selectedPhase === phase.id
                      ? theme.colors.background
                      : theme.colors.textSecondary,
                }}
                className="text-xs font-semibold"
              >
                {phase.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Phase Info */}
      <View className="px-6 mb-4">
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          }}
          className="rounded-2xl p-4 border"
        >
          <View className="flex-row items-center gap-3 mb-2">
            <Text className="text-4xl">{currentPhaseConfig?.emoji}</Text>
            <View className="flex-1">
              <Text
                style={{ color: theme.colors.text }}
                className="text-xl font-bold"
              >
                {currentPhaseConfig?.name}
              </Text>
              <Text style={{ color: theme.colors.textSecondary }} className="text-sm">
                {currentPhaseConfig?.arabicName}
              </Text>
            </View>
          </View>
          <Text style={{ color: theme.colors.textSecondary }} className="text-xs">
            {phaseLetters.length} letters to master
          </Text>
        </View>
      </View>

      {/* Letter Grid */}
      <ScrollView className="flex-1 px-6">
        <View className="flex-row flex-wrap justify-between gap-3 pb-6">
          {phaseLetters.map((letter, index) => {
            const status = getLetterStatus(letter.id);
            return (
              <TouchableOpacity
                key={index}
                onPress={() => handleLetterPress(letter.id)}
                style={{
                  backgroundColor:
                    status === 'mastered'
                      ? theme.colors.success
                      : status === 'completed'
                      ? theme.colors.secondary
                      : theme.colors.surface,
                  opacity: status === 'mastered' ? 0.2 : status === 'completed' ? 0.15 : 1,
                }}
                className="w-[23%] aspect-square rounded-2xl items-center justify-center"
              >
                <Text
                  style={{ color: theme.colors.primary }}
                  className="text-4xl font-bold mb-1"
                >
                  {letter.forms.isolated}
                </Text>
                <Text
                  style={{ color: theme.colors.textSecondary }}
                  className="text-xs font-semibold text-center"
                >
                  {letter.transliteration}
                </Text>
                {status === 'mastered' && (
                  <View className="absolute top-1 right-1">
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={theme.colors.success}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
