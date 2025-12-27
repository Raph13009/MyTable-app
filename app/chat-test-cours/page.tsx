'use client'

import { useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Message = Database['public']['Tables']['messages']['Row']
type Participant = Database['public']['Tables']['participants']['Row']

// Page de test pour voir une conversation de type "Cours de Cuisine"
export default function ChatTestCoursPage() {
  const [mockUser] = useState<User>({
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    confirmation_sent_at: null,
    recovery_sent_at: null,
    email_confirmed_at: new Date().toISOString(),
    invited_at: null,
    action_link: null,
    last_sign_in_at: new Date().toISOString(),
    phone: null,
    phone_confirmed_at: null,
    confirmed_at: new Date().toISOString(),
    is_anonymous: false,
  } as User)

  const [mockMessages] = useState<Message[]>([
    {
      id: 'msg-1',
      conversation_id: 'test-conv-cours',
      sender_email: 'chef@example.com',
      content: 'Bonjour ! Merci pour votre demande de cours de cuisine. Je serais ravi de vous enseigner.',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    } as Message,
    {
      id: 'msg-2',
      conversation_id: 'test-conv-cours',
      sender_email: 'test@example.com',
      content: 'Parfait ! Nous aimerions un cours de 3 jours pour apprendre les bases de la cuisine française.',
      created_at: new Date(Date.now() - 82800000).toISOString(),
    } as Message,
  ])

  const [mockParticipants] = useState<Participant[]>([
    {
      id: 'part-1',
      conversation_id: 'test-conv-cours',
      email: 'test@example.com',
      role: 'client',
      user_id: 'test-user-id',
      created_at: new Date().toISOString(),
    } as Participant,
    {
      id: 'part-2',
      conversation_id: 'test-conv-cours',
      email: 'chef@example.com',
      role: 'chef',
      user_id: 'chef-user-id',
      created_at: new Date().toISOString(),
    } as Participant,
  ])

  // Booking request de test (cours de cuisine)
  const [mockBookingRequest] = useState({
    id: 'test-br-cours',
    conversation_id: 'test-conv-cours',
    chef_id: 'chef-1',
    status: 'accepted',
    first_name: 'Marie',
    last_name: 'Bernard',
    email: 'test@example.com',
    phone: '+33612345678',
    booking_date: null, // Pas de date pour cours de cuisine
    guests_count: 2,
    city: 'Lyon',
    postal_code: '69001',
    menu_id: null, // Pas de menu pour cours de cuisine
    has_allergies: false,
    allergies_details: null,
    notes: 'Nous aimerions apprendre les techniques de base.',
    service_type: 'cours_cuisine' as const,
    period_days: '3', // 3 jours
    extras: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-yellow-400 border-b-2 border-black p-2 text-center text-sm font-semibold">
        ⚠️ MODE TEST - Cours de Cuisine - Données fictives
      </div>
      <ChatInterface
        conversationId="test-conv-cours"
        initialMessages={mockMessages}
        participants={mockParticipants}
        currentUser={mockUser}
        bookingRequest={mockBookingRequest}
        menuDetails={undefined}
        showAcceptedMessage={true}
        isAdmin={false}
      />
    </div>
  )
}
