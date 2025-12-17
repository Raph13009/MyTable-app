#!/bin/bash

# Script pour tester les participants d'une conversation
# Usage: ./test-participants.sh <conversationId>

CONVERSATION_ID=$1

if [ -z "$CONVERSATION_ID" ]; then
  echo "Usage: ./test-participants.sh <conversationId>"
  echo "Exemple: ./test-participants.sh 5b366de0-142b-4d54-a048-296914a11a7f"
  exit 1
fi

echo "🔍 Vérification des participants pour la conversation: $CONVERSATION_ID"
echo ""

# Vérifier les participants via l'API
echo "📋 Participants dans la conversation:"
curl -s "http://localhost:3000/api/check-participant?conversationId=$CONVERSATION_ID&email=test@test.com" | jq '.'

echo ""
echo "✅ Test terminé"

