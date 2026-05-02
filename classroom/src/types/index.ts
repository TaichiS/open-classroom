// 使用者角色
export type UserRole = 'teacher' | 'student'

// 來自 profiles 表的用戶資料
export interface Profile {
  id: string
  name: string
  role: UserRole
  avatar?: string
  createdAt: string
}

// 課程類型
export interface Course {
  id: string
  name: string
  description: string
  materialUrl?: string
  coverImage?: string
  courseCode: string
  teacherId: string
  createdAt: string
}

// 課程成員類型
export interface CourseMember {
  id: string
  courseId: string
  studentId: string
  joinedAt: string
  currentAssignmentIndex: number
}

// 作業提交類型
export type SubmitType = 'complete' | 'file' | 'link' | 'image'

// 作業類型
export interface Assignment {
  id: string
  courseId: string
  title: string
  description: string
  orderIndex: number
  submitType: SubmitType
  releaseDate: string
  dueDate?: string
  isActive: boolean
  createdAt: string
  showcaseEnabled: boolean
  showcaseRequireApproval: boolean
}

// 提交狀態
export type SubmissionStatus = 'pending' | 'completed' | 'late'

// 作業提交類型
export interface Submission {
  id: string
  assignmentId: string
  studentId: string
  status: SubmissionStatus
  submitData?: string
  submittedAt?: string
  feedback?: string
  showcaseApproved?: boolean
  showcaseRejected?: boolean
  showcaseRejectReason?: string
}

// 帶提交狀態的作業
export interface AssignmentWithStatus extends Assignment {
  submission?: Submission
  isUnlocked: boolean
}

// 帶學生資訊的提交
export interface SubmissionWithStudent extends Submission {
  studentName: string
  studentEmail: string
}

// 課程統計
export interface CourseStats {
  totalStudents: number
  totalAssignments: number
  completedCount: number
  progressPercentage: number
}

// 討論區訊息類型
export interface DiscussionMessage {
  id: string
  assignmentId: string
  courseId: string
  userId: string
  userName: string
  userRole: UserRole
  content: string
  parentId?: string
  createdAt: string
  updatedAt?: string
}

// 展示中心的作業項目
export interface ShowcaseItem {
  submission: SubmissionWithStudent
  assignment: Assignment
  course: Course
}
