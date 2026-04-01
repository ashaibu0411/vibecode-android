# End-to-end messaging (1:1 DMs)

## What this gives you

- For **Supabase-backed conversations with exactly two human participants**, message bodies are stored as **ciphertext** in `messages.content` (prefix `E2E1:`).
- **Private keys stay on the device** (Expo SecureStore on native; AsyncStorage on web — **weaker** on web).
- People with **database or dashboard access** see ciphertext, not the plaintext (unless they also control a device with a user’s private key).

## What it does **not** guarantee

- **Metadata** (who messaged whom, timestamps, conversation membership) is still visible server-side.
- **Group chats** (more than two participants in `conversation_participants`) are **not** encrypted with this scheme.
- **Business / local** threads using ids like `business_*` are treated as **plaintext** (no row in `conversation_participants`).
- **Push notifications** are not covered here; do not put message body in push payloads if you need full E2E story.
- **Backups**, **malware on device**, and **compromised clients** can still expose plaintext.

## Server setup

1. Run the migration: `supabase/migrations/20260214120000_profiles_e2e_public_key.sql` (adds `profiles.e2e_public_key`).
2. Ensure RLS allows authenticated users to **update their own** `profiles` row (including `e2e_public_key`).

## Client usage

- After sign-in, the app calls `syncE2ePublicKeyToProfile(userId)` (see `app/_layout.tsx`).
- Use `sendMessage` / `getMessages(conversationId, viewerUserId)` from `src/lib/messages.ts`; encryption is automatic for qualifying DMs.
- Realtime inserts only include raw rows — use `decryptRealtimeMessagePayload(conversationId, viewerUserId, payload)` before showing text.

## Crypto (summary)

- **Curve25519** DH (`tweetnacl` `scalarMult`) → shared secret → **XSalsa20-Poly1305** (`secretbox`) per message with random nonce.
