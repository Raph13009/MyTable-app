# Comment tester les APIs

## Créer un chef

### Option 1: Via curl (terminal)

```bash
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
```

### Option 2: Via le navigateur (console JavaScript)

Ouvrez la console du navigateur (F12) sur `http://localhost:3000` et exécutez :

```javascript
fetch('http://localhost:3000/api/chefs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    slug: 'chef-michel',
    name: 'Michel Dubois',
    email: 'raphaellevy027@gmail.com',
    phone: '+33123456789',
    city: 'Paris',
    postal_code: '75001'
  })
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err))
```

### Option 3: Via Postman ou Insomnia

- URL: `POST http://localhost:3000/api/chefs`
- Headers: `Content-Type: application/json`
- Body (JSON):
```json
{
  "slug": "chef-michel",
  "name": "Michel Dubois",
  "email": "raphaellevy027@gmail.com",
  "phone": "+33123456789",
  "city": "Paris",
  "postal_code": "75001"
}
```

## Créer les utilisateurs auth pour les chefs existants

```bash
curl http://localhost:3000/api/create-chef-users
```

Ou dans le navigateur :
```
http://localhost:3000/api/create-chef-users
```

## ⚠️ Important

- Assurez-vous que votre serveur Next.js est lancé : `npm run dev`
- Les routes API ne fonctionnent PAS dans le SQL Editor de Supabase
- Utilisez un client HTTP (curl, Postman, navigateur) pour tester les APIs

