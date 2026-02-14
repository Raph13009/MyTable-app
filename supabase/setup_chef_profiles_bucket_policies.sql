-- Setup bucket + policies pour les photos de profil et de plats
-- Bucket cible: chef-profiles
-- Dossiers utilisés:
-- - chef-profiles/... (photos de profil existantes)
-- - chef-dishes/{chefId}/... (photos de plats)

-- 1) Créer le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public)
SELECT 'chef-profiles', 'chef-profiles', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'chef-profiles'
);

-- 2) S'assurer que le bucket est public
UPDATE storage.buckets
SET public = true
WHERE id = 'chef-profiles';

-- 3) Policies objets storage
-- Remplacer l'UID admin si nécessaire
DO $$
DECLARE
  admin_uid TEXT := '8d154623-1aba-475c-9a7b-9ab39f3f84d2';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chef_profiles_public_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "chef_profiles_public_read"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'chef-profiles')
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chef_profiles_admin_insert'
  ) THEN
    EXECUTE format($policy$
      CREATE POLICY "chef_profiles_admin_insert"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'chef-profiles' AND auth.uid() = '%s'::uuid)
    $policy$, admin_uid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chef_profiles_admin_update'
  ) THEN
    EXECUTE format($policy$
      CREATE POLICY "chef_profiles_admin_update"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'chef-profiles' AND auth.uid() = '%s'::uuid)
      WITH CHECK (bucket_id = 'chef-profiles' AND auth.uid() = '%s'::uuid)
    $policy$, admin_uid, admin_uid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chef_profiles_admin_delete'
  ) THEN
    EXECUTE format($policy$
      CREATE POLICY "chef_profiles_admin_delete"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'chef-profiles' AND auth.uid() = '%s'::uuid)
    $policy$, admin_uid);
  END IF;
END $$;
