/**
 * Script de test pour vérifier les participants et conversations
 * Usage: npx tsx test-dashboard-participants.ts <email>
 */

import { createAdminClient } from './lib/supabase/admin'

async function testDashboardParticipants(userEmail: string) {
  const supabaseAdmin = createAdminClient()
  const normalizedUserEmail = userEmail.toLowerCase().trim()

  console.log('========================================')
  console.log('TEST DASHBOARD PARTICIPANTS')
  console.log('========================================')
  console.log('User email:', userEmail)
  console.log('Normalized email:', normalizedUserEmail)
  console.log('')

  // 1. Récupérer tous les participants
  console.log('1. Fetching all participants...')
  const { data: allParticipants, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select('conversation_id, role, email, user_id')

  if (participantsError) {
    console.error('❌ Error fetching participants:', participantsError)
    return
  }

  console.log(`✅ Found ${allParticipants?.length || 0} participants total`)
  console.log('')

  // 2. Afficher tous les participants
  console.log('2. All participants:')
  allParticipants?.forEach((p, i) => {
    const normalizedEmail = p.email?.toLowerCase().trim() || ''
    const matches = normalizedEmail === normalizedUserEmail
    console.log(`  ${i + 1}. Email: "${p.email}" (normalized: "${normalizedEmail}")`)
    console.log(`     Role: ${p.role}`)
    console.log(`     User ID: ${p.user_id || 'null'}`)
    console.log(`     Conversation ID: ${p.conversation_id}`)
    console.log(`     Matches user email: ${matches ? '✅ YES' : '❌ NO'}`)
    console.log('')
  })

  // 3. Filtrer les participants correspondant à l'utilisateur
  console.log('3. Filtering participants for user...')
  const userParticipants = (allParticipants || []).filter(p => {
    const participantEmail = p.email?.toLowerCase().trim() || ''
    return participantEmail === normalizedUserEmail
  })

  console.log(`✅ Found ${userParticipants.length} matching participants`)
  console.log('')

  if (userParticipants.length === 0) {
    console.log('❌ NO PARTICIPANTS FOUND FOR THIS EMAIL!')
    console.log('')
    console.log('Possible issues:')
    console.log('1. The email in participants table does not match the user email')
    console.log('2. The participants were not created correctly')
    console.log('3. The email normalization is different')
    return
  }

  // 4. Récupérer les conversations
  const conversationIds = userParticipants.map(p => p.conversation_id)
  console.log('4. Conversation IDs:', conversationIds)
  console.log('')

  // 5. Récupérer les conversations avec booking_requests
  console.log('5. Fetching conversations...')
  const { data: conversations, error: conversationsError } = await supabaseAdmin
    .from('conversations')
    .select(`
      *,
      booking_requests (
        id,
        status,
        first_name,
        last_name,
        email,
        booking_date,
        city,
        guests_count
      )
    `)
    .in('id', conversationIds)

  if (conversationsError) {
    console.error('❌ Error fetching conversations:', conversationsError)
    return
  }

  console.log(`✅ Found ${conversations?.length || 0} conversations`)
  console.log('')

  // 6. Afficher les conversations
  console.log('6. Conversations:')
  conversations?.forEach((conv: any, i) => {
    const bookingRequest = conv.booking_requests?.[0]
    console.log(`  ${i + 1}. Conversation ID: ${conv.id}`)
    if (bookingRequest) {
      console.log(`     Booking Request ID: ${bookingRequest.id}`)
      console.log(`     Status: ${bookingRequest.status}`)
      console.log(`     Client: ${bookingRequest.first_name} ${bookingRequest.last_name}`)
      console.log(`     Client Email: ${bookingRequest.email}`)
      console.log(`     Date: ${bookingRequest.booking_date}`)
      console.log(`     City: ${bookingRequest.city}`)
    } else {
      console.log(`     ⚠️ No booking request found`)
    }
    console.log('')
  })

  console.log('========================================')
  console.log('TEST COMPLETE')
  console.log('========================================')
}

// Récupérer l'email depuis les arguments
const userEmail = process.argv[2]

if (!userEmail) {
  console.error('Usage: npx tsx test-dashboard-participants.ts <email>')
  process.exit(1)
}

testDashboardParticipants(userEmail)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

