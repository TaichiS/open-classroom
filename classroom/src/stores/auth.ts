import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { findProfileById } from '@/lib/db'
import type { Profile } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(null)
  const isLoading = ref(true)

  const isLoggedIn = computed(() => user.value !== null && profile.value !== null)
  const isTeacher = computed(() => profile.value?.role === 'teacher')
  const isStudent = computed(() => profile.value?.role === 'student')
  // True when Google OAuth completed but user hasn't selected a role yet
  const needsOnboarding = computed(() => user.value !== null && profile.value === null && !isLoading.value)

  async function initialize() {
    // 先註冊監聽器，避免初始化過程中漏接 auth 事件
    supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      session.value = currentSession
      user.value = currentSession?.user ?? null
      if (currentSession?.user) {
        try {
          profile.value = await findProfileById(currentSession.user.id)
        } catch (e) {
          console.error('Failed to refresh profile on auth state change:', e)
        }
      } else {
        profile.value = null
      }
    })

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      session.value = currentSession
      if (currentSession?.user) {
        user.value = currentSession.user
        try {
          profile.value = await findProfileById(currentSession.user.id)
        } catch (e) {
          console.error('Failed to load profile during init:', e)
          profile.value = null
        }
      }
    } catch (e) {
      console.error('Auth initialization failed:', e)
    } finally {
      // 不論成功失敗，一定要結束 loading 狀態，避免 router guard 永遠卡住
      isLoading.value = false
    }
  }

  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function logout() {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
    profile.value = null
  }

  async function refreshProfile() {
    if (user.value) {
      profile.value = await findProfileById(user.value.id)
    }
  }

  initialize()

  return {
    session,
    user,
    profile,
    isLoading,
    isLoggedIn,
    isTeacher,
    isStudent,
    needsOnboarding,
    loginWithGoogle,
    logout,
    refreshProfile,
  }
})
