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
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    session.value = currentSession
    if (currentSession?.user) {
      user.value = currentSession.user
      profile.value = await findProfileById(currentSession.user.id)
    }
    isLoading.value = false

    supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      session.value = currentSession
      user.value = currentSession?.user ?? null
      if (currentSession?.user) {
        profile.value = await findProfileById(currentSession.user.id)
      } else {
        profile.value = null
      }
    })
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
