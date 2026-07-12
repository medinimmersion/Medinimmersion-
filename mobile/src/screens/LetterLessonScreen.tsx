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

export default function LetterLessonScreen({ route, navigation }) {
  const { letterId } = route.params || {};
  const { letters, currentLetter, setCurrentLetter, addXP, masterLesson } =
    useGameState();

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
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-600">Loading lesson...</Text>
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
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-3">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#000" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-800">
            {currentLetter.arabicName}
          </Text>
          <Text className="text-sm font-semibold text-purple-600">
            {currentStep + 1}/{lessonSteps.length}
          </Text>
        </View>
        {/* Progress bar */}
        <View className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <View
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Introduction Step */}
        {currentLessonStep.type === 'introduction' && (
          <View className="p-6">
            <View className="items-center mb-6">
              <Text className="text-7xl font-bold text-purple-600 mb-4">
                {currentLetter.forms.isolated}
              </Text>
              <Text className="text-2xl font-bold text-gray-800 mb-2">
                {currentLetter.arabicName}
              </Text>
              <Text className="text-lg text-gray-600">
                {currentLetter.transliteration}
              </Text>
            </View>

            <View className="bg-purple-50 p-4 rounded-xl border border-purple-200 mb-6">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Anatomical Guide:
              </Text>
              <Text className="text-sm text-gray-600">
                {currentLetter.anatomicalNotes}
              </Text>
            </View>

            <View className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Difficulty Level:
              </Text>
              <View className="flex-row gap-1">
                {[...Array(5)].map((_, i) => (
                  <View
                    key={i}
                    className={`h-2 flex-1 rounded ${
                      i < currentLetter.difficultyLevel
                        ? 'bg-orange-500'
                        : 'bg-gray-300'
                    }`}
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
              <View className="w-40 h-40 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 items-center justify-center mb-6">
                <Text className="text-6xl font-bold text-purple-600">
                  {currentLetter.forms.isolated}
                </Text>
              </View>

              <Text className="text-xl font-semibold text-gray-800 mb-6 text-center">
                {currentLetter.pronunciation}
              </Text>

              <TouchableOpacity className="w-20 h-20 rounded-full items-center justify-center mb-6 bg-gradient-to-br from-purple-500 to-purple-700">
                <Ionicons name="play" size={32} color="white" />
              </TouchableOpacity>

              <Text className="text-center text-gray-600 text-sm mb-6">
                Tap to hear pronunciation
              </Text>
            </View>

            <View className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <Text className="font-semibold text-gray-800 mb-2">💡 Tip:</Text>
              <Text className="text-sm text-gray-600">
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
            <Text className="text-lg font-bold text-gray-800 mb-6">
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
                className="mb-4 p-4 bg-white rounded-xl border border-gray-200"
              >
                <Text className="text-sm font-semibold text-gray-600 mb-3">
                  {item.position}
                </Text>
                <View className="h-20 items-center justify-center bg-gray-50 rounded-lg">
                  <Text className="text-5xl font-bold text-purple-600">
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
            <Text className="text-lg font-bold text-gray-800 mb-6">
              Example Words
            </Text>

            {currentLetter.exampleWords.map((word, index) => (
              <TouchableOpacity
                key={index}
                className="mb-4 p-4 bg-white rounded-xl border border-gray-200 active:bg-gray-50"
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-gray-800 mb-1">
                      {word}
                    </Text>
                  </View>
                  <TouchableOpacity className="bg-purple-100 p-3 rounded-full">
                    <Ionicons name="volume-high" size={20} color="#8B5CF6" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quiz Step */}
        {currentLessonStep.type === 'quiz' && (
          <View className="p-6">
            <Text className="text-lg font-bold text-gray-800 mb-6">
              Knowledge Check
            </Text>

            <View className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-200">
              <Text className="text-base font-semibold text-gray-800 mb-4">
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
                  className="mb-3 p-4 bg-white rounded-lg border border-gray-200 active:bg-gray-100"
                >
                  <Text className="text-base font-semibold text-gray-800">
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
            className={`flex-1 py-3 rounded-lg border-2 items-center ${
              currentStep === 0 ? 'border-gray-200 opacity-50' : 'border-gray-300'
            }`}
          >
            <Text className="font-bold text-gray-800">← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNextStep}
            className={`flex-1 py-3 rounded-lg items-center ${
              currentStep === lessonSteps.length - 1
                ? 'bg-green-500'
                : 'bg-purple-600'
            }`}
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
