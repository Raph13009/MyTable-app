'use client'

import { useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Message = Database['public']['Tables']['messages']['Row']
type Participant = Database['public']['Tables']['participants']['Row']

// Page de test pour voir une conversation sans authentification
export default function ChatTestPage() {
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

  // Messages de test
  const [mockMessages] = useState<Message[]>([
    {
      id: 'msg-1',
      conversation_id: 'test-conv-1',
      sender_email: 'chef@example.com',
      content: 'Bonjour ! Merci pour votre demande de réservation. Je serais ravi de cuisiner pour vous le 15 février au dîner.',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    } as Message,
    {
      id: 'msg-2',
      conversation_id: 'test-conv-1',
      sender_email: 'test@example.com',
      content: 'Merci beaucoup ! Nous sommes 4 personnes (dont 1 enfant) et nous aimerions réserver pour le 15 février.',
      created_at: new Date(Date.now() - 82800000).toISOString(),
    } as Message,
    {
      id: 'msg-3',
      conversation_id: 'test-conv-1',
      sender_email: 'chef@example.com',
      content: 'Parfait ! Le 15 février me convient très bien. J\'ai bien noté l\'allergie aux fruits de mer et aux arachides. Je vous propose un menu adapté.',
      created_at: new Date(Date.now() - 79200000).toISOString(),
    } as Message,
    {
      id: 'msg-4',
      conversation_id: 'test-conv-1',
      sender_email: 'test@example.com',
      content: 'Super, merci beaucoup ! Pourriez-vous aussi ajouter un service traiteur et une bouteille de vin premium ?',
      created_at: new Date(Date.now() - 7200000).toISOString(),
    } as Message,
    {
      id: 'msg-5',
      conversation_id: 'test-conv-1',
      sender_email: 'chef@example.com',
      content: 'Bien sûr ! J\'ai ajouté ces extras à votre réservation. Le total s\'élève à 270€ (180€ pour les menus + 60€ pour le vin + 30€ pour le service traiteur).',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    } as Message,
    {
      id: 'msg-6',
      conversation_id: 'test-conv-1',
      sender_email: 'test@example.com',
      content: 'Parfait, c\'est noté ! On a hâte de vous recevoir.',
      created_at: new Date(Date.now() - 1800000).toISOString(),
    } as Message,
  ])

  // Participants de test
  const [mockParticipants] = useState<Participant[]>([
    {
      id: 'part-1',
      conversation_id: 'test-conv-1',
      email: 'test@example.com',
      role: 'client',
      user_id: 'test-user-id',
      created_at: new Date().toISOString(),
    } as Participant,
    {
      id: 'part-2',
      conversation_id: 'test-conv-1',
      email: 'chef@example.com',
      role: 'chef',
      user_id: 'chef-user-id',
      created_at: new Date().toISOString(),
    } as Participant,
  ])

  // Booking request de test (repas à domicile)
  const [mockBookingRequest] = useState({
    id: 'test-br-1',
    conversation_id: 'test-conv-1',
    chef_id: 'chef-1',
    status: 'accepted',
    first_name: 'Jean',
    last_name: 'Dupont',
    email: 'test@example.com',
    phone: '+33612345678',
    booking_date: '2024-02-15',
    guests_count: 4,
    children_count: 1,
    city: 'Paris',
    postal_code: '75001',
    menu_id: 'menu-1',
    has_allergies: true,
    allergies_details: 'Allergie aux fruits de mer et aux arachides',
    notes: 'Nous aimerions un menu végétarien si possible.',
    service_type: 'repas_domicile' as const,
    period_days: null,
    meal_time: 'diner' as const,
    extras: [
      { name: 'Vin premium', price: 60 },
      { name: 'Service traiteur', price: 30 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  // Menu details de test
  const [mockMenuDetails] = useState({
    id: 'menu-1',
    chef_id: 'chef-1',
    name: 'Menu Découverte',
    description: 'Un menu pour découvrir notre cuisine avec entrée, plat et dessert',
    price: 45.00,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-yellow-400 border-b-2 border-black p-2 text-center text-sm font-semibold">
        ⚠️ MODE TEST - Données fictives - Conversation ID: test-conv-1
      </div>
      <ChatInterface
        conversationId="test-conv-1"
        initialMessages={mockMessages}
        participants={mockParticipants}
        currentUser={mockUser}
        bookingRequest={mockBookingRequest}
        menuDetails={mockMenuDetails}
        showAcceptedMessage={true}
        isAdmin={false}
      />
    </div>
  )
}
