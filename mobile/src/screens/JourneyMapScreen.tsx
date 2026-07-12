import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGameState } from '../hooks/useGameState';
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
    <SafeAreaView className="flex-1 bg-white">
      {/* Phase Carousel */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-4">
        <View className="pl-6 pr-4 flex-row gap-3">
          {PHASES.map((phase) => (
            <TouchableOpacity
              key={phase.id}
              onPress={() => setSelectedPhase(phase.id)}
              className={`px-6 py-3 rounded-full justify-center items-center ${
                selectedPhase === phase.id
                  ? 'bg-purple-600'
                  : 'bg-gray-100'
              }`}
            >
              <Text className="text-xl mb-1">{phase.emoji}</Text>
              <Text
                className={`text-xs font-semibold ${
                  selectedPhase === phase.id
                    ? 'text-white'
                    : 'text-gray-600'
                }`}
              >
                {phase.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Phase Info */}
      <View className="px-6 mb-4">
        <View className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-4">
          <View className="flex-row items-center gap-3 mb-2">
            <Text className="text-4xl">{currentPhaseConfig?.emoji}</Text>
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {currentPhaseConfig?.name}
              </Text>
              <Text className="text-sm text-gray-600">
                {currentPhaseConfig?.arabicName}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-gray-500">
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
                className={`w-[23%] aspect-square rounded-2xl items-center justify-center ${
                  status === 'mastered'
                    ? 'bg-green-100'
                    : status === 'completed'
                    ? 'bg-blue-100'
                    : 'bg-gray-100'
                }`}
              >
                <Text className="text-4xl font-bold text-purple-600 mb-1">
                  {letter.forms.isolated}
                </Text>
                <Text className="text-xs font-semibold text-gray-600 text-center">
                  {letter.transliteration}
                </Text>
                {status === 'mastered' && (
                  <View className="absolute top-1 right-1">
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#10b981"
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
