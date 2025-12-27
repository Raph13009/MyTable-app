'use client'

import { useState } from 'react'
import ConversationsList from '@/components/ConversationsList'
import { User } from '@supabase/supabase-js'

// Page de test pour voir le dashboard sans authentification
export default function DashboardTestPage() {
  const [mockUser] = useState<User>({
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    confirmation_sent_at: undefined,
    recovery_sent_at: undefined,
    email_confirmed_at: new Date().toISOString(),
    invited_at: undefined,
    action_link: undefined,
    last_sign_in_at: new Date().toISOString(),
    phone: undefined,
    phone_confirmed_at: undefined,
    confirmed_at: new Date().toISOString(),
    is_anonymous: false,
  } as User)

  // Données de test pour les conversations
  const [mockConversations] = useState([
    {
      id: 'test-conv-1',
      status: 'ongoing' as const,
      bookingRequest: {
        id: 'test-br-1',
        status: 'accepted',
        first_name: 'Jean',
        last_name: 'Dupont',
        booking_date: '2024-02-15',
        city: 'Paris',
        guests_count: 4,
        chefName: 'Chef Martin',
        menuPrice: 45,
        extras: [],
        totalPrice: 180,
        service_type: 'repas_domicile' as const,
        period_days: null,
      },
      participants: [
        { email: 'test@example.com', role: 'client' },
        { email: 'chef@example.com', role: 'chef' },
      ],
      lastMessage: {
        content: 'Parfait, je confirme pour le 15 février !',
        created_at: new Date().toISOString(),
        sender_email: 'test@example.com',
      },
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'test-conv-2',
      status: 'pending' as const,
      bookingRequest: {
        id: 'test-br-2',
        status: 'pending',
        first_name: 'Marie',
        last_name: 'Bernard',
        booking_date: undefined,
        city: 'Lyon',
        guests_count: 2,
        chefName: 'Chef Sophie',
        menuPrice: 50,
        extras: [],
        totalPrice: 100,
        service_type: 'cours_cuisine' as const,
        period_days: '1-2',
      },
      participants: [
        { email: 'test@example.com', role: 'client' },
        { email: 'chef2@example.com', role: 'chef' },
      ],
      lastMessage: {
        content: 'Merci pour votre demande, je vais y réfléchir.',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        sender_email: 'chef2@example.com',
      },
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'test-conv-3',
      status: 'ongoing' as const,
      bookingRequest: {
        id: 'test-br-3',
        status: 'accepted',
        first_name: 'Pierre',
        last_name: 'Martin',
        booking_date: undefined,
        city: 'Marseille',
        guests_count: 6,
        chefName: 'Chef Antoine',
        menuPrice: 40,
        extras: [],
        totalPrice: 240,
        service_type: 'mise_en_demeure' as const,
        period_days: '3',
      },
      participants: [
        { email: 'test@example.com', role: 'client' },
        { email: 'chef3@example.com', role: 'chef' },
      ],
      lastMessage: {
        content: 'Super, on se voit bientôt !',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        sender_email: 'test@example.com',
      },
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-yellow-400 border-b-2 border-black p-2 text-center text-sm font-semibold">
        ⚠️ MODE TEST - Données fictives
      </div>
      <ConversationsList
        conversations={mockConversations}
        currentUser={mockUser}
        participantsMap={new Map()}
      />
    </div>
  )
}
