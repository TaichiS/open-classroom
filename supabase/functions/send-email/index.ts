import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface EmailPayload {
  assignmentId: string
  type: 'assignment_released'
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const payload: EmailPayload = await req.json()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Get assignment info
  const { data: assignment, error: assignmentError } = await supabase
    .from('assignments')
    .select('id, title, description, due_date, course_id')
    .eq('id', payload.assignmentId)
    .single()

  if (assignmentError || !assignment) {
    return new Response('Assignment not found', { status: 404 })
  }

  // Get course info
  const { data: course } = await supabase
    .from('courses')
    .select('name')
    .eq('id', assignment.course_id)
    .single()

  // Get enrolled students
  const { data: members } = await supabase
    .from('course_members')
    .select('student_id')
    .eq('course_id', assignment.course_id)

  if (!members?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const studentIds = members.map((m: { student_id: string }) => m.student_id)

  // Get student emails via admin API
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const studentEmails = users
    .filter(u => studentIds.includes(u.id) && u.email)
    .map(u => u.email as string)

  if (!studentEmails.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const appUrl = req.headers.get('origin') ?? 'https://your-app.vercel.app'
  const dueDateText = assignment.due_date
    ? `<p style="color:#6b7280">截止時間：${new Date(assignment.due_date).toLocaleString('zh-TW')}</p>`
    : ''

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#1e293b">${course?.name ?? ''}</h2>
      <h3 style="color:#334155">📋 新作業：${assignment.title}</h3>
      <p style="color:#475569">${assignment.description}</p>
      ${dueDateText}
      <a href="${appUrl}/assignment/${assignment.id}"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:500">
        前往作業
      </a>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'noreply@resend.dev',
      to: studentEmails,
      subject: `新作業：${assignment.title}`,
      html,
    }),
  })

  const result = await res.json()
  return new Response(JSON.stringify(result), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
})
