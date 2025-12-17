-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: chefs
CREATE TABLE chefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  postal_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: menus
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chef_id UUID NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: booking_requests
CREATE TABLE booking_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chef_id UUID NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  conversation_id UUID,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  booking_date DATE NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  guests_count INTEGER NOT NULL,
  has_allergies BOOLEAN DEFAULT FALSE,
  allergies_details TEXT,
  menu_id UUID REFERENCES menus(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'refused')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_request_id UUID REFERENCES booking_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key after conversations table is created
ALTER TABLE booking_requests 
ADD CONSTRAINT fk_booking_conversation 
FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;

-- Table: participants
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'chef')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, email)
);

-- Table: messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: decision_tokens
CREATE TABLE decision_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_request_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK (action IN ('accept', 'refuse')),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_menus_chef_id ON menus(chef_id);
CREATE INDEX idx_booking_requests_chef_id ON booking_requests(chef_id);
CREATE INDEX idx_booking_requests_status ON booking_requests(status);
CREATE INDEX idx_booking_requests_conversation_id ON booking_requests(conversation_id);
CREATE INDEX idx_participants_conversation_id ON participants(conversation_id);
CREATE INDEX idx_participants_email ON participants(email);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_decision_tokens_token_hash ON decision_tokens(token_hash);
CREATE INDEX idx_decision_tokens_booking_request_id ON decision_tokens(booking_request_id);
CREATE INDEX idx_chefs_slug ON chefs(slug);

-- Enable Row Level Security
ALTER TABLE chefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chefs (public read)
CREATE POLICY "Chefs are viewable by everyone" ON chefs
  FOR SELECT USING (true);

-- RLS Policies for menus (public read)
CREATE POLICY "Menus are viewable by everyone" ON menus
  FOR SELECT USING (true);

-- RLS Policies for booking_requests
CREATE POLICY "Users can view their own booking requests" ON booking_requests
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM participants 
      WHERE participants.conversation_id = booking_requests.conversation_id
    ) OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- RLS Policies for conversations
CREATE POLICY "Users can view conversations they participate in" ON conversations
  FOR SELECT USING (
    id IN (
      SELECT conversation_id FROM participants 
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- RLS Policies for participants
CREATE POLICY "Users can view participants in their conversations" ON participants
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM participants 
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM participants 
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages in their conversations" ON messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT conversation_id FROM participants 
      WHERE user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- RLS Policies for decision_tokens (no public access, only via API)
CREATE POLICY "No public access to decision tokens" ON decision_tokens
  FOR ALL USING (false);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_chefs_updated_at BEFORE UPDATE ON chefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON menus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_requests_updated_at BEFORE UPDATE ON booking_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

