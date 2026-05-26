export type EventStatus = 'draft' | 'published' | 'live' | 'ended'
export type EventType = 'closed' | 'open'
export type InvitationStatus = 'pending' | 'entered' | 'cancelled'
export type RegistrationStatus = 'pending' | 'accepted' | 'rejected' | 'waitlist'

export interface Event {
  id: string
  organizer_id: string
  name: string
  date: string
  time: string | null
  venue: string
  description: string | null
  capacity: number | null
  status: EventStatus
  event_type: EventType
  registration_slug: string | null
  max_registrations: number | null
  banner_url?: string | null
  sender_profile_id?: string | null
  created_at: string
  updated_at: string
}

export interface Guest {
  id: string
  event_id: string
  name: string
  phone: string | null
  email: string | null
  created_at: string
}

export interface Invitation {
  id: string
  event_id: string
  guest_id: string
  party_size: number
  seat_info: string | null
  status: InvitationStatus
  created_at: string
  guest?: Guest
}

export interface ScannerLink {
  id: string
  event_id: string
  token: string
  label: string
  is_active: boolean
  created_at: string
}

export interface EntryLog {
  id: string
  invitation_id: string
  scanner_link_id: string | null
  scanned_at: string
  notes: string | null
  invitation?: Invitation & { guest?: Guest }
}

export interface Registration {
  id: string
  event_id: string
  full_name: string
  email: string
  phone: string | null
  status: RegistrationStatus
  waitlist_position?: number | null
  created_at: string
}

export interface EmailLog {
  id: string
  event_id: string
  recipient_email: string
  email_type: 'invitation' | 'reminder'
  subject: string | null
  sent_at: string
}

export interface SenderProfile {
  id: string
  organizer_id: string
  display_name: string   // shown in From: header
  reply_to: string       // organizer's contact email for this brand
  is_default: boolean
  created_at: string
  updated_at: string
}

export type TeamRole = 'owner' | 'viewer' | 'scanner_manager' | 'co_organiser'
export type MemberRole = 'viewer' | 'scanner_manager' | 'co_organiser'

export interface EventMember {
  id: string
  event_id: string
  organizer_id: string
  member_id: string
  role: MemberRole
  invited_by: string
  created_at: string
  // Joined via admin client — populated by getTeamMembers()
  member_email?: string
  member_name?: string
}
