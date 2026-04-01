-- Public half of device E2E keys (Curve25519). Private keys never leave the client.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS e2e_public_key text;

COMMENT ON COLUMN public.profiles.e2e_public_key IS 'Base64 Curve25519 public key for 1:1 DM encryption (optional).';

-- Ensure authenticated users can UPDATE their own profile row (including e2e_public_key).
-- Add only if you do not already have an equivalent policy:
-- CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
--   USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
