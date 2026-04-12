import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { findProfileById } from '@/lib/db'
import type { Profile } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(null)
  const isLoading = ref(true)

  const isLoggedIn = computed(() => user.value !== null && profile.value !== null)
  const isTeacher = computed(() => profile.value?.role === 'teacher')
  const isStudent = computed(() => profile.value?.role === 'student')
  // True when Google OAuth completed but user hasn't selected a role yet
  const needsOnboarding = computed(() => user.value !== null && profile.value === null && !isLoading.value)

  async function initialize() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      user.value = session.user
      profile.value = await findProfileById(session.user.id)
    }
    isLoading.value = false

    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      if (session?.user) {
        profile.value = await findProfileById(session.user.id)
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
