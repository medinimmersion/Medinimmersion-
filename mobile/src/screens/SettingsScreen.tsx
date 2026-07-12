import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 py-6">
          <Text className="text-3xl font-bold text-gray-900">Settings</Text>
        </View>

        {/* Account Section */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase">
            Account
          </Text>
          <TouchableOpacity className="bg-white rounded-xl p-4 mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <Ionicons name="person" size={20} color="#8B5CF6" />
              <Text className="text-base text-gray-800 font-semibold">
                Profile
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase">
            Preferences
          </Text>
          <TouchableOpacity className="bg-white rounded-xl p-4 mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <Ionicons name="volume-high" size={20} color="#8B5CF6" />
              <Text className="text-base text-gray-800 font-semibold">
                Audio Settings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity className="bg-white rounded-xl p-4 mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <Ionicons name="language" size={20} color="#8B5CF6" />
              <Text className="text-base text-gray-800 font-semibold">
                Language
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity className="bg-white rounded-xl p-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <Ionicons name="notifications" size={20} color="#8B5CF6" />
              <Text className="text-base text-gray-800 font-semibold">
                Notifications
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase">
            Support
          </Text>
          <TouchableOpacity className="bg-white rounded-xl p-4 mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <Ionicons name="help-circle" size={20} color="#8B5CF6" />
              <Text className="text-base text-gray-800 font-semibold">
                Help & FAQ
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity className="bg-white rounded-xl p-4 mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <Ionicons name="mail" size={20} color="#8B5CF6" />
              <Text className="text-base text-gray-800 font-semibold">
                Contact Us
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity className="bg-white rounded-xl p-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <Ionicons name="information-circle" size={20} color="#8B5CF6" />
              <Text className="text-base text-gray-800 font-semibold">
                About
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <View className="px-6 mb-8">
          <TouchableOpacity className="bg-red-50 border border-red-200 rounded-xl p-4 items-center">
            <Text className="text-red-600 font-bold text-base">Logout</Text>
          </TouchableOpacity>
        </View>

        <View className="px-6 pb-8 items-center">
          <Text className="text-xs text-gray-500">
            MédinImmersion RIHLA v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
