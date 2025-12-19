# Configuration Supabase Storage pour les photos de profil des chefs

## 1. Créer le bucket

Dans le dashboard Supabase, allez dans **Storage** et créez un nouveau bucket :

- **Nom du bucket** : `chef-profiles`
- **Public** : ✅ Oui (pour que les images soient accessibles publiquement)
- **File size limit** : 5 MB (ou selon vos besoins)
- **Allowed MIME types** : `image/jpeg, image/png, image/webp`

## 2. Configurer les politiques RLS (Row Level Security)

Dans **Storage** > **Policies** pour le bucket `chef-profiles`, ajoutez les politiques suivantes :

### Politique 1 : Lecture publique (pour afficher les images)
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'chef-profiles');
```

### Politique 2 : Upload autorisé (pour l'admin uniquement via l'API)
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chef-profiles' 
  AND auth.role() = 'authenticated'
);
```

### Politique 3 : Mise à jour autorisée
```sql
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chef-profiles' 
  AND auth.role() = 'authenticated'
);
```

### Politique 4 : Suppression autorisée
```sql
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chef-profiles' 
  AND auth.role() = 'authenticated'
);
```

## 3. Alternative : Politique plus permissive pour l'admin

Si vous préférez une approche plus simple (mais moins sécurisée), vous pouvez utiliser :

```sql
-- Permettre toutes les opérations sur le bucket chef-profiles
CREATE POLICY "Allow all operations on chef-profiles"
ON storage.objects
FOR ALL
USING (bucket_id = 'chef-profiles')
WITH CHECK (bucket_id = 'chef-profiles');
```

⚠️ **Note** : Cette politique est moins sécurisée mais fonctionne pour un environnement de développement/admin.

## 4. Vérification

Après la configuration, testez l'upload d'une image via l'interface admin. Les images devraient être accessibles via l'URL publique retournée par Supabase Storage.

## 5. Structure des fichiers

Les fichiers sont stockés dans le bucket avec le chemin suivant :
```
chef-profiles/{chef-id}-{random}.{extension}
```

Exemple : `chef-profiles/123e4567-e89b-12d3-a456-426614174000-abc123.jpg`

