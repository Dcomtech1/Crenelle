import { NextRequest, NextResponse } from 'next/server'
import { sendInvitationEmail, sendReminderEmailsDirect } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type } = body

    if (type === 'invitation') {
      const { eventId, recipientEmail, recipientName, invitationId, event } = body
      const res = await sendInvitationEmail({
        eventId,
        recipientEmail,
        recipientName,
        invitationId,
        event,
      })

      if (res.error) {
        return NextResponse.json({ error: res.error }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    } else if (type === 'reminder') {
      const { eventId, recipients, event, customMessage } = body
      const res = await sendReminderEmailsDirect({
        eventId,
        recipients,
        event,
        customMessage,
      })

      return NextResponse.json({
        success: true,
        sent: res.sent,
        errors: res.errors,
      })
    }

    return NextResponse.json({ error: 'Invalid email type' }, { status: 400 })
  } catch (e: any) {
    console.error('API Send email error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
