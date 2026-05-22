import { NextRequest, NextResponse } from 'next/server'
import { sendInvitationEmail, sendReminderEmailsDirect } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Require authentication
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, eventId } = body

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
    }

    // Fetch the event from the database securely.
    // RLS ensures the user can only fetch their own events.
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('name, date, time, venue, description, banner_url')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found or access denied' }, { status: 404 })
    }

    if (type === 'invitation') {
      const { recipientEmail, recipientName, invitationId } = body
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
      const { recipients, customMessage } = body
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
