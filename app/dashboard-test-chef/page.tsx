'use client'

import { useState } from 'react'
import ConversationsList from '@/components/ConversationsList'
import { User } from '@supabase/supabase-js'

// Page de test pour voir le dashboard côté CHEF sans authentification
export default function DashboardTestChefPage() {
  const [mockUser] = useState<User>({
    id: 'test-chef-user-id',
    email: 'chef@example.com',
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

  // Données de test pour les conversations (vue CHEF)
  const [mockConversations] = useState([
    {
      id: 'test-conv-chef-1',
      status: 'ongoing' as const,
      bookingRequest: {
        id: 'test-br-chef-1',
        status: 'accepted',
        first_name: 'Jean',
        last_name: 'Dupont',
        booking_date: '2024-02-15',
        city: 'Paris',
        guests_count: 4,
        children_count: 1,
        chefName: 'Chef Martin',
        menuPrice: 45,
        extras: [],
        totalPrice: 180,
        service_type: 'repas_domicile' as const,
        period_days: null,
        meal_time: 'diner' as const,
      },
      participants: [
        { email: 'client1@example.com', role: 'client' },
        { email: 'chef@example.com', role: 'chef' },
      ],
      lastMessage: {
        content: 'Parfait, je confirme pour le 15 février !',
        created_at: new Date().toISOString(),
        sender_email: 'client1@example.com',
      },
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'test-conv-chef-2',
      status: 'pending' as const,
      bookingRequest: {
        id: 'test-br-chef-2',
        status: 'pending',
        first_name: 'Marie',
        last_name: 'Bernard',
        booking_date: undefined,
        city: 'Lyon',
        guests_count: 2,
        children_count: 0,
        chefName: 'Chef Martin',
        menuPrice: 50,
        extras: [],
        totalPrice: 100,
        service_type: 'cours_cuisine' as const,
        period_days: null,
        budget: 200,
        course_topic: 'Techniques de base de la pâtisserie française',
      },
      participants: [
        { email: 'client2@example.com', role: 'client' },
        { email: 'chef@example.com', role: 'chef' },
      ],
      lastMessage: {
        content: 'Merci pour votre demande, je vais y réfléchir.',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        sender_email: 'chef@example.com',
      },
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'test-conv-chef-3',
      status: 'ongoing' as const,
      bookingRequest: {
        id: 'test-br-chef-3',
        status: 'accepted',
        first_name: 'Pierre',
        last_name: 'Martin',
        booking_date: undefined,
        city: 'Marseille',
        guests_count: 6,
        children_count: 2,
        chefName: 'Chef Martin',
        menuPrice: 40,
        extras: [],
        totalPrice: 1200,
        service_type: 'mise_en_demeure' as const,
        period_days: null,
        selected_dates: ['2024-03-01', '2024-03-02', '2024-03-03'],
        meal_options: ['pdj', 'dejeuner', 'diner'],
        total_price: 1200,
      },
      participants: [
        { email: 'client3@example.com', role: 'client' },
        { email: 'chef@example.com', role: 'chef' },
      ],
      lastMessage: {
        content: 'Super, on se voit bientôt !',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        sender_email: 'client3@example.com',
      },
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'test-conv-chef-4',
      status: 'closed' as const,
      bookingRequest: {
        id: 'test-br-chef-4',
        status: 'validated_by_client',
        first_name: 'Sophie',
        last_name: 'Lefebvre',
        booking_date: '2024-01-20',
        city: 'Nice',
        guests_count: 3,
        children_count: 0,
        chefName: 'Chef Martin',
        menuPrice: 55,
        extras: [{ name: 'Vin premium', price: 80 }],
        totalPrice: 245,
        service_type: 'repas_domicile' as const,
        period_days: null,
        meal_time: 'dejeuner' as const,
      },
      participants: [
        { email: 'client4@example.com', role: 'client' },
        { email: 'chef@example.com', role: 'chef' },
      ],
      lastMessage: {
        content: 'Merci pour ce magnifique repas !',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        sender_email: 'client4@example.com',
      },
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-yellow-400 border-b-2 border-black p-2 text-center text-sm font-semibold">
        ⚠️ MODE TEST CHEF - Données fictives (Vue Chef)
      </div>
      <ConversationsList
        conversations={mockConversations}
        currentUser={mockUser}
        participantsMap={new Map()}
      />
    </div>
  )
}
