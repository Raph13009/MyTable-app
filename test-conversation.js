// Script de test pour vérifier les conversations
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Lire .env.local manuellement
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found')
    process.exit(1)
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8')
  const env = {}
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  })
  
  return env
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConversations() {
  console.log('========================================')
  console.log('🔍 Testing conversations...')
  console.log('========================================\n')

  // 1. Lister toutes les conversations
  console.log('1. Listing all conversations:')
  const { data: allConvs, error: allError } = await supabase
    .from('conversations')
    .select('id, created_at, booking_request_id')
    .order('created_at', { ascending: false })
    .limit(10)

  if (allError) {
    console.error('❌ Error:', allError)
  } else {
    console.log(`✅ Found ${allConvs?.length || 0} conversations:`)
    allConvs?.forEach((conv, i) => {
      console.log(`   ${i + 1}. ID: ${conv.id}`)
      console.log(`      Created: ${conv.created_at}`)
      console.log(`      Booking request: ${conv.booking_request_id || 'none'}`)
    })
  }

  // 2. Tester avec un ID spécifique (le dernier créé)
  if (allConvs && allConvs.length > 0) {
    const testId = allConvs[0].id
    console.log(`\n2. Testing query with specific ID: ${testId}`)
    
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('*, booking_requests(*)')
      .eq('id', testId)
      .single()

    if (convError) {
      console.error('❌ Error:', convError)
      console.error('   Code:', convError.code)
      console.error('   Message:', convError.message)
    } else {
      console.log('✅ Conversation found:', {
        id: conv.id,
        hasBookingRequest: !!conv.booking_requests,
      })
    }

    // 3. Tester avec maybeSingle
    console.log(`\n3. Testing with maybeSingle():`)
    const { data: conv2, error: convError2 } = await supabase
      .from('conversations')
      .select('*, booking_requests(*)')
      .eq('id', testId)
      .maybeSingle()

    if (convError2) {
      console.error('❌ Error:', convError2)
    } else if (conv2) {
      console.log('✅ Conversation found with maybeSingle')
    } else {
      console.log('⚠️  No conversation found (null returned)')
    }
  }

  // 4. Vérifier les participants
  if (allConvs && allConvs.length > 0) {
    const testId = allConvs[0].id
    console.log(`\n4. Testing participants for conversation: ${testId}`)
    
    const { data: participants, error: partError } = await supabase
      .from('participants')
      .select('*')
      .eq('conversation_id', testId)

    if (partError) {
      console.error('❌ Error:', partError)
    } else {
      console.log(`✅ Found ${participants?.length || 0} participants:`)
      participants?.forEach((p, i) => {
        console.log(`   ${i + 1}. Email: ${p.email}, Role: ${p.role}, User ID: ${p.user_id || 'none'}`)
      })
    }
  }

  console.log('\n========================================')
  console.log('✅ Test completed')
  console.log('========================================')
}

testConversations().catch(console.error)

