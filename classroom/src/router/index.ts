import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Login from '@/views/Login.vue'
import AuthCallback from '@/views/AuthCallback.vue'
import Onboarding from '@/views/Onboarding.vue'
import StudentDashboard from '@/views/student/Dashboard.vue'
import StudentCourseDetail from '@/views/student/CourseDetail.vue'
import AssignmentSubmit from '@/views/student/AssignmentSubmit.vue'
import Discussion from '@/views/student/Discussion.vue'
import Showcase from '@/views/student/Showcase.vue'
import TeacherDashboard from '@/views/teacher/Dashboard.vue'
import TeacherCourseDetail from '@/views/teacher/CourseDetail.vue'
import AssignmentSubmissions from '@/views/teacher/AssignmentSubmissions.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'Login', component: Login, meta: { public: true } },
    { path: '/auth/callback', name: 'AuthCallback', component: AuthCallback, meta: { public: true } },
    { path: '/onboarding', name: 'Onboarding', component: Onboarding, meta: { requiresAuth: true, onboarding: true } },
    { path: '/', name: 'StudentDashboard', component: StudentDashboard, meta: { requiresAuth: true, role: 'student' } },
    { path: '/course/:id', name: 'StudentCourseDetail', component: StudentCourseDetail, meta: { requiresAuth: true, role: 'student' } },
    { path: '/assignment/:id', name: 'AssignmentSubmit', component: AssignmentSubmit, meta: { requiresAuth: true, role: 'student' } },
    { path: '/discussion/:id', name: 'Discussion', component: Discussion, meta: { requiresAuth: true, role: 'student' } },
    { path: '/showcase', name: 'Showcase', component: Showcase, meta: { requiresAuth: true, role: 'student' } },
    { path: '/teacher', name: 'TeacherDashboard', component: TeacherDashboard, meta: { requiresAuth: true, role: 'teacher' } },
    { path: '/teacher/course/:id', name: 'TeacherCourseDetail', component: TeacherCourseDetail, meta: { requiresAuth: true, role: 'teacher' } },
    { path: '/teacher/submissions/:id', name: 'AssignmentSubmissions', component: AssignmentSubmissions, meta: { requiresAuth: true, role: 'teacher' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // Wait for Supabase auth to initialize
  if (authStore.isLoading) {
    await new Promise<void>(resolve => {
      const unwatch = authStore.$subscribe((_mutation, state) => {
        if (!state.isLoading) {
          unwatch()
          resolve()
        }
      })
    })
  }

  const isLoggedIn = authStore.isLoggedIn
  const needsOnboarding = authStore.needsOnboarding
  const userRole = authStore.profile?.role

  // Unauthenticated → login
  if (to.meta.requiresAuth && !isLoggedIn && !needsOnboarding) {
    next('/login')
    return
  }

  // Needs onboarding → force to /onboarding (except callback page)
  if (needsOnboarding && !to.meta.onboarding && to.path !== '/auth/callback') {
    next('/onboarding')
    return
  }

  // Already logged in → don't go to public pages
  if (to.meta.public && isLoggedIn) {
    next(userRole === 'teacher' ? '/teacher' : '/')
    return
  }

  // Role check
  if (to.meta.role && to.meta.role !== userRole) {
    next(userRole === 'teacher' ? '/teacher' : '/')
    return
  }

  next()
})

export default router
