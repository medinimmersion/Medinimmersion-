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

export default function LetterLessonScreen({ route, navigation }) {
  const { letterId } = route.params || {};
  const { letters, currentLetter, setCurrentLetter, addXP, masterLesson } =
    useGameState();
  const { getTheme } = useAppSettings();
  const theme = getTheme();

  const [currentStep, setCurrentStep] = useState(0);

  React.useEffect(() => {
    if (letterId && letters.length > 0) {
      const letter = letters.find((l) => l.id === letterId);
      if (letter) {
        setCurrentLetter(letter);
      }
    }
  }, [letterId, letters]);

  if (!currentLetter) {
    return (
      <SafeAreaView
        style={{ backgroundColor: theme.colors.background }}
        className="flex-1 items-center justify-center"
      >
        <Text style={{ color: theme.colors.textSecondary }}>Loading lesson...</Text>
      </SafeAreaView>
    );
  }

  const lessonSteps = [
    { id: '1', type: 'introduction', title: `Learn ${currentLetter.arabicName}` },
    { id: '2', type: 'pronunciation', title: 'How to Pronounce' },
    { id: '3', type: 'forms', title: 'Letter Forms' },
    { id: '4', type: 'examples', title: 'Example Words' },
    { id: '5', type: 'quiz', title: 'Knowledge Check' },
  ];

  const currentLessonStep = lessonSteps[currentStep];
  const progress = ((currentStep + 1) / lessonSteps.length) * 100;

  const handleQuizComplete = (score: number) => {
    const xpEarned = Math.round((score / 100) * 50);
    addXP(xpEarned);

    if (score >= 85) {
      masterLesson(currentLetter.id);
    }

    setTimeout(() => {
      if (currentStep < lessonSteps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        navigation.goBack();
      }
    }, 1500);
  };

  const handleNextStep = () => {
    if (currentStep < lessonSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      navigation.goBack();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: theme.colors.background }} className="flex-1">
      {/* Header */}
      <View
        style={{
          borderBottomColor: theme.colors.border,
        }}
        className="px-4 py-3 border-b"
      >
        <View className="flex-row justify-between items-center mb-3">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={{ color: theme.colors.text }} className="text-lg font-bold">
            {currentLetter.arabicName}
          </Text>
          <Text style={{ color: theme.colors.primary }} className="text-sm font-semibold">
            {currentStep + 1}/{lessonSteps.length}
          </Text>
        </View>
        {/* Progress bar */}
        <View
          style={{ backgroundColor: theme.colors.border }}
          className="w-full h-2 rounded-full overflow-hidden"
        >
          <View
            style={{
              backgroundColor: theme.colors.primary,
              width: `${progress}%`,
            }}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Introduction Step */}
        {currentLessonStep.type === 'introduction' && (
          <View className="p-6">
            <View className="items-center mb-6">
              <Text
                style={{ color: theme.colors.primary }}
                className="text-7xl font-bold mb-4"
              >
                {currentLetter.forms.isolated}
              </Text>
              <Text style={{ color: theme.colors.text }} className="text-2xl font-bold mb-2">
                {currentLetter.arabicName}
              </Text>
              <Text style={{ color: theme.colors.textSecondary }} className="text-lg">
                {currentLetter.transliteration}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              }}
              className="p-4 rounded-xl border mb-6"
            >
              <Text
                style={{ color: theme.colors.text }}
                className="text-sm font-semibold mb-2"
              >
                Anatomical Guide:
              </Text>
              <Text style={{ color: theme.colors.textSecondary }} className="text-sm">
                {currentLetter.anatomicalNotes}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              }}
              className="p-4 rounded-xl border"
            >
              <Text
                style={{ color: theme.colors.text }}
                className="text-sm font-semibold mb-2"
              >
                Difficulty Level:
              </Text>
              <View className="flex-row gap-1">
                {[...Array(5)].map((_, i) => (
                  <View
                    key={i}
                    style={{
                      backgroundColor:
                        i < currentLetter.difficultyLevel
                          ? theme.colors.secondary
                          : theme.colors.border,
                    }}
                    className="h-2 flex-1 rounded"
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Pronunciation Step */}
        {currentLessonStep.type === 'pronunciation' && (
          <View className="p-6">
            <View className="items-center mb-8">
              <View
                style={{
                  backgroundColor: theme.colors.surface,
                }}
                className="w-40 h-40 rounded-full items-center justify-center mb-6"
              >
                <Text
                  style={{ color: theme.colors.primary }}
                  className="text-6xl font-bold"
                >
                  {currentLetter.forms.isolated}
                </Text>
              </View>

              <Text
                style={{ color: theme.colors.text }}
                className="text-xl font-semibold mb-6 text-center"
              >
                {currentLetter.pronunciation}
              </Text>

              <TouchableOpacity
                style={{ backgroundColor: theme.colors.primary }}
                className="w-20 h-20 rounded-full items-center justify-center mb-6"
              >
                <Ionicons name="play" size={32} color={theme.colors.background} />
              </TouchableOpacity>

              <Text
                style={{ color: theme.colors.textSecondary }}
                className="text-center text-sm mb-6"
              >
                Tap to hear pronunciation
              </Text>
            </View>

            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              }}
              className="p-4 rounded-xl border"
            >
              <Text style={{ color: theme.colors.text }} className="font-semibold mb-2">
                💡 Tip:
              </Text>
              <Text style={{ color: theme.colors.textSecondary }} className="text-sm">
                Listen to the pronunciation multiple times. Try mimicking the
                sound naturally without forcing it. Pronunciation improves with
                practice!
              </Text>
            </View>
          </View>
        )}

        {/* Forms Step */}
        {currentLessonStep.type === 'forms' && (
          <View className="p-6">
            <Text style={{ color: theme.colors.text }} className="text-lg font-bold mb-6">
              Letter Forms in Different Positions
            </Text>

            {[
              { position: 'Isolated', form: currentLetter.forms.isolated },
              { position: 'Beginning', form: currentLetter.forms.beginning },
              { position: 'Middle', form: currentLetter.forms.middle },
              { position: 'End', form: currentLetter.forms.end },
            ].map((item, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                }}
                className="mb-4 p-4 rounded-xl border"
              >
                <Text
                  style={{ color: theme.colors.textSecondary }}
                  className="text-sm font-semibold mb-3"
                >
                  {item.position}
                </Text>
                <View
                  style={{
                    backgroundColor: theme.colors.background,
                  }}
                  className="h-20 items-center justify-center rounded-lg"
                >
                  <Text
                    style={{ color: theme.colors.primary }}
                    className="text-5xl font-bold"
                  >
                    {item.form}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Examples Step */}
        {currentLessonStep.type === 'examples' && (
          <View className="p-6">
            <Text style={{ color: theme.colors.text }} className="text-lg font-bold mb-6">
              Example Words
            </Text>

            {currentLetter.exampleWords.map((word, index) => (
              <TouchableOpacity
                key={index}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                }}
                className="mb-4 p-4 rounded-xl border"
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text style={{ color: theme.colors.text }} className="text-xl font-bold mb-1">
                      {word}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: theme.colors.surface,
                    }}
                    className="p-3 rounded-full"
                  >
                    <Ionicons name="volume-high" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quiz Step */}
        {currentLessonStep.type === 'quiz' && (
          <View className="p-6">
            <Text style={{ color: theme.colors.text }} className="text-lg font-bold mb-6">
              Knowledge Check
            </Text>

            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              }}
              className="mb-6 p-4 rounded-xl border"
            >
              <Text
                style={{ color: theme.colors.text }}
                className="text-base font-semibold mb-4"
              >
                Question 1: Which word contains {currentLetter.arabicName}?
              </Text>

              {[
                currentLetter.exampleWords[0],
                'كتاب',
                'نور',
                'صوت',
              ].map((option, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() =>
                    handleQuizComplete(index === 0 ? 100 : Math.max(0, 50))
                  }
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  }}
                  className="mb-3 p-4 rounded-lg border"
                >
                  <Text style={{ color: theme.colors.text }} className="text-base font-semibold">
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Navigation buttons */}
        <View className="px-6 py-6 flex-row gap-4">
          <TouchableOpacity
            onPress={handlePreviousStep}
            disabled={currentStep === 0}
            style={{
              borderColor:
                currentStep === 0 ? theme.colors.border : theme.colors.textSecondary,
              opacity: currentStep === 0 ? 0.5 : 1,
            }}
            className="flex-1 py-3 rounded-lg border-2 items-center"
          >
            <Text style={{ color: theme.colors.text }} className="font-bold">
              ← Back
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNextStep}
            style={{
              backgroundColor:
                currentStep === lessonSteps.length - 1
                  ? theme.colors.success
                  : theme.colors.primary,
            }}
            className="flex-1 py-3 rounded-lg items-center"
          >
            <Text className="font-bold text-white">
              {currentStep === lessonSteps.length - 1 ? 'Complete ✓' : 'Next →'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
