#!/bin/bash
# Script pour tester la création d'un chef
# Usage: ./test-create-chef.sh

curl -X POST http://localhost:3000/api/chefs \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "chef-michel",
    "name": "Michel Dubois",
    "email": "raphaellevy027@gmail.com",
    "phone": "+33123456789",
    "city": "Paris",
    "postal_code": "75001"
  }'
