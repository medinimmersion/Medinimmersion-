import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings } from '../hooks/useAppSettings';
import { LanguageCode, ThemeName } from '../theme/themes';

export default function SettingsScreen() {
  const { language, theme, setLanguage, setTheme, t, getTheme } = useAppSettings();
  const currentTheme = getTheme();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const languages: { code: LanguageCode; label: string; flag: string }[] = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  ];

  const themes_list: { code: ThemeName; label: string }[] = [
    { code: 'medinimmersion', label: t('settings_theme_medin') },
    { code: 'purple', label: t('settings_theme_purple') },
  ];

  return (
    <SafeAreaView
      style={{ backgroundColor: currentTheme.colors.background }}
      className="flex-1"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 py-6">
          <Text
            style={{ color: currentTheme.colors.text }}
            className="text-3xl font-bold"
          >
            ⚙️ {t('nav_settings')}
          </Text>
        </View>

        {/* Preferences Section */}
        <View className="px-6 mb-6">
          <Text
            style={{ color: currentTheme.colors.textSecondary }}
            className="text-sm font-semibold mb-3 uppercase"
          >
            {t('settings_language')}
          </Text>

          {/* Language Selection */}
          <TouchableOpacity
            onPress={() => setShowLanguageModal(true)}
            style={{ backgroundColor: currentTheme.colors.surface }}
            className="rounded-xl p-4 mb-2 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3 flex-1">
              <Ionicons
                name="language"
                size={20}
                color={currentTheme.colors.primary}
              />
              <View className="flex-1">
                <Text
                  style={{ color: currentTheme.colors.text }}
                  className="text-base font-semibold"
                >
                  {t('settings_language')}
                </Text>
                <Text
                  style={{ color: currentTheme.colors.textSecondary }}
                  className="text-xs"
                >
                  {languages.find((l) => l.code === language)?.label}
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={currentTheme.colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Theme Selection */}
          <TouchableOpacity
            onPress={() => setShowThemeModal(true)}
            style={{ backgroundColor: currentTheme.colors.surface }}
            className="rounded-xl p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3 flex-1">
              <Ionicons
                name="palette"
                size={20}
                color={currentTheme.colors.primary}
              />
              <View className="flex-1">
                <Text
                  style={{ color: currentTheme.colors.text }}
                  className="text-base font-semibold"
                >
                  {t('settings_theme')}
                </Text>
                <Text
                  style={{ color: currentTheme.colors.textSecondary }}
                  className="text-xs"
                >
                  {themes_list.find((th) => th.code === theme)?.label}
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={currentTheme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View className="px-6 mb-6">
          <Text
            style={{ color: currentTheme.colors.textSecondary }}
            className="text-sm font-semibold mb-3 uppercase"
          >
            {t('profile')}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: currentTheme.colors.surface }}
            className="rounded-xl p-4 mb-2 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3 flex-1">
              <Ionicons
                name="person"
                size={20}
                color={currentTheme.colors.primary}
              />
              <Text
                style={{ color: currentTheme.colors.text }}
                className="text-base font-semibold"
              >
                {t('profile')}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={currentTheme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View className="px-6 mb-6">
          <Text
            style={{ color: currentTheme.colors.textSecondary }}
            className="text-sm font-semibold mb-3 uppercase"
          >
            Support
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: currentTheme.colors.surface }}
            className="rounded-xl p-4 mb-2 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3 flex-1">
              <Ionicons
                name="help-circle"
                size={20}
                color={currentTheme.colors.primary}
              />
              <Text
                style={{ color: currentTheme.colors.text }}
                className="text-base font-semibold"
              >
                {t('settings_help')}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={currentTheme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <View className="px-6 mb-8">
          <TouchableOpacity
            style={{
              backgroundColor: currentTheme.colors.error,
              opacity: 0.1,
              borderWidth: 1,
              borderColor: currentTheme.colors.error,
            }}
            className="rounded-xl p-4 items-center"
          >
            <Text style={{ color: currentTheme.colors.error }} className="font-bold text-base">
              {t('logout')}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="px-6 pb-8 items-center">
          <Text
            style={{ color: currentTheme.colors.textSecondary }}
            className="text-xs"
          >
            MédinImmersion RIHLA v1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Language Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          className="flex-1 justify-end"
        >
          <View
            style={{ backgroundColor: currentTheme.colors.background }}
            className="rounded-t-3xl p-6"
          >
            <Text
              style={{ color: currentTheme.colors.text }}
              className="text-xl font-bold mb-4"
            >
              {t('settings_language')}
            </Text>

            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => {
                  setLanguage(lang.code);
                  setShowLanguageModal(false);
                }}
                style={{
                  backgroundColor:
                    language === lang.code
                      ? currentTheme.colors.accent
                      : currentTheme.colors.surface,
                  borderWidth: language === lang.code ? 2 : 0,
                  borderColor: currentTheme.colors.primary,
                }}
                className="rounded-xl p-4 mb-3 flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-2xl">{lang.flag}</Text>
                  <Text
                    style={{ color: currentTheme.colors.text }}
                    className="text-base font-semibold"
                  >
                    {lang.label}
                  </Text>
                </View>
                {language === lang.code && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={currentTheme.colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setShowLanguageModal(false)}
              style={{ backgroundColor: currentTheme.colors.primary }}
              className="rounded-xl p-4 items-center mt-4"
            >
              <Text className="text-white font-bold">{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Theme Modal */}
      <Modal
        visible={showThemeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          className="flex-1 justify-end"
        >
          <View
            style={{ backgroundColor: currentTheme.colors.background }}
            className="rounded-t-3xl p-6"
          >
            <Text
              style={{ color: currentTheme.colors.text }}
              className="text-xl font-bold mb-4"
            >
              {t('settings_theme')}
            </Text>

            {themes_list.map((themeOption) => (
              <TouchableOpacity
                key={themeOption.code}
                onPress={() => {
                  setTheme(themeOption.code);
                  setShowThemeModal(false);
                }}
                style={{
                  backgroundColor:
                    theme === themeOption.code
                      ? currentTheme.colors.accent
                      : currentTheme.colors.surface,
                  borderWidth: theme === themeOption.code ? 2 : 0,
                  borderColor: currentTheme.colors.primary,
                }}
                className="rounded-xl p-4 mb-3 flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-3">
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      backgroundColor:
                        themeOption.code === 'medinimmersion'
                          ? '#d97706'
                          : '#7c3aed',
                    }}
                  />
                  <Text
                    style={{ color: currentTheme.colors.text }}
                    className="text-base font-semibold flex-1"
                  >
                    {themeOption.label}
                  </Text>
                </View>
                {theme === themeOption.code && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={currentTheme.colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setShowThemeModal(false)}
              style={{ backgroundColor: currentTheme.colors.primary }}
              className="rounded-xl p-4 items-center mt-4"
            >
              <Text className="text-white font-bold">{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
