#!/bin/bash
# Script pour créer le chef Raphael avec son utilisateur auth
# Usage: ./create-chef-raphael.sh

echo "Création du chef Raphael avec utilisateur auth..."

curl -X POST http://localhost:3000/api/chefs \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "chef-raphael",
    "name": "Raphael Levy",
    "email": "raphaellevy027@gmail.com",
    "phone": "+33123456789",
    "city": "Paris",
    "postal_code": "75001"
  }' | jq '.'

echo ""
echo "✅ Chef créé avec succès !"
