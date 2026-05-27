export type EventStatus = 'draft' | 'published' | 'live' | 'ended'
export type EventType = 'closed' | 'open'
export type InvitationStatus = 'pending' | 'active' | 'cancelled' | 'checked_in' | 'expired'
export type RegistrationStatus = 'pending' | 'accepted' | 'rejected' | 'waitlist'
export type AttendeeSource = 'imported' | 'public_registration' | 'manual'

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
  timezone: string // NEW — default 'Africa/Lagos'
  created_at: string
  updated_at: string
}

export interface Attendee {
  id: string
  event_id: string
  name: string
  email: string | null
  phone: string | null
  source: AttendeeSource
  registration_status: RegistrationStatus | null
  ticket_tier_id: string | null
  created_at: string
}

export interface Invitation {
  id: string
  event_id: string
  attendee_id: string
  party_size: number
  seat_info: string | null
  status: InvitationStatus
  ticket_tier_id: string | null
  payment_reference: string | null
  qr_token: string
  checked_in_at: string | null
  checked_in_by: string | null
  created_at: string
  attendee?: Attendee
}

export interface TicketTier {
  id: string
  event_id: string
  name: string
  price: number // stored in kobo (NGN)
  capacity: number | null
  is_public: boolean
  currency: string
  deleted_at: string | null
  created_at: string
}

export interface TierPerk {
  id: string
  tier_id: string
  label: string
  icon: string | null
  sort_order: number | null
  created_at: string
}

export interface InvitationAuditLog {
  id: string
  invitation_id: string
  changed_by: string | null
  old_status: InvitationStatus | null
  new_status: InvitationStatus | null
  old_tier_id: string | null
  new_tier_id: string | null
  reason: string | null
  created_at: string
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
  invitation?: Invitation & { attendee?: Attendee }
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
