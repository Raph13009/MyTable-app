-- Adresse complète du lieu d'événement (saisie unifiée côté client)
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS full_address TEXT;

COMMENT ON COLUMN booking_requests.full_address IS 'Adresse libellée complète (rue, code postal, ville) saisie ou choisie par le client.';

-- Étendre la RPC d'insertion pour inclure full_address
CREATE OR REPLACE FUNCTION insert_booking_with_json_meal_options(
  p_chef_id UUID,
  p_conversation_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_service_type TEXT,
  p_booking_date DATE,
  p_meal_time TEXT,
  p_city TEXT,
  p_postal_code TEXT,
  p_guests_count INTEGER,
  p_children_count INTEGER,
  p_period_days TEXT,
  p_budget DECIMAL,
  p_course_topic TEXT,
  p_selected_dates JSONB,
  p_meal_options JSONB,
  p_total_price DECIMAL,
  p_has_allergies BOOLEAN,
  p_allergies_details TEXT,
  p_menu_id UUID,
  p_notes TEXT,
  p_status TEXT,
  p_full_address TEXT DEFAULT NULL
)
RETURNS booking_requests
LANGUAGE plpgsql
AS $$
DECLARE
  v_result booking_requests;
BEGIN
  INSERT INTO booking_requests (
    chef_id, conversation_id, first_name, last_name, email, phone,
    service_type, booking_date, meal_time, city, postal_code, full_address,
    guests_count, children_count, period_days, budget, course_topic,
    selected_dates, meal_options, total_price,
    has_allergies, allergies_details, menu_id, notes, status
  ) VALUES (
    p_chef_id, p_conversation_id, p_first_name, p_last_name, p_email, p_phone,
    p_service_type, p_booking_date, p_meal_time, p_city, p_postal_code, p_full_address,
    p_guests_count, p_children_count, p_period_days, p_budget, p_course_topic,
    p_selected_dates, p_meal_options::jsonb, p_total_price,
    p_has_allergies, p_allergies_details, p_menu_id, p_notes, p_status
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
