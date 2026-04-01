import { supabase } from './supabase';
import {
  decryptDmPlaintext,
  encryptDmPlaintext,
  fetchPeerE2ePublicKey,
  getOrCreateE2eIdentity,
  isE2eEnvelope,
  publicKeyFromBase64,
} from './e2eMessaging';

/** Local-only business threads (not in conversation_participants) stay plaintext */
function isLocalBusinessConversation(conversationId: string): boolean {
  return conversationId.startsWith('business_');
}

async function listParticipantUserIds(conversationId: string): Promise<string[]> {
  const { data } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId);
  return (data ?? []).map((r) => r.user_id);
}

async function shouldUseE2eForConversation(conversationId: string): Promise<boolean> {
  if (isLocalBusinessConversation(conversationId)) return false;
  const ids = await listParticipantUserIds(conversationId);
  return ids.length === 2;
}

async function getOtherParticipantUserId(conversationId: string, myUserId: string): Promise<string | null> {
  const ids = await listParticipantUserIds(conversationId);
  if (ids.length !== 2) return null;
  const other = ids.find((id) => id !== myUserId);
  return other ?? null;
}

type MessageRow = {
  content: string;
  sender_id: string;
  sender?: { e2e_public_key?: string | null } | null;
};

/** Decrypt E2E1: rows for a 1:1 Supabase conversation; fetches sender keys if join missing. */
async function decryptMessageContents<T extends MessageRow>(
  rows: T[],
  conversationId: string,
  viewerUserId: string
): Promise<T[]> {
  if (!(await shouldUseE2eForConversation(conversationId))) return rows;
  const other = await getOtherParticipantUserId(conversationId, viewerUserId);
  if (!other) return rows;

  const { secretKey } = await getOrCreateE2eIdentity(viewerUserId);
  let otherPk: Uint8Array | null = null;
  try {
    const ob = await fetchPeerE2ePublicKey(other);
    if (ob) otherPk = publicKeyFromBase64(ob);
  } catch {
    /* ignore */
  }

  const withPeers = await Promise.all(
    rows.map(async (row) => {
      if (!isE2eEnvelope(row.content)) return { row, peerPk: null as Uint8Array | null };
      let peerPk: Uint8Array | null = null;
      if (row.sender_id === viewerUserId) {
        peerPk = otherPk;
      } else {
        const fromJoin = row.sender?.e2e_public_key;
        if (fromJoin) {
          try {
            peerPk = publicKeyFromBase64(String(fromJoin));
          } catch {
            peerPk = null;
          }
        }
        if (!peerPk) {
          const b64 = await fetchPeerE2ePublicKey(row.sender_id);
          peerPk = b64 ? publicKeyFromBase64(b64) : null;
        }
      }
      return { row, peerPk };
    })
  );

  return withPeers.map(({ row, peerPk }) => {
    if (!isE2eEnvelope(row.content)) return row;
    try {
      if (!peerPk) {
        return { ...row, content: '[Encrypted — open the app once to sync keys]' } as T;
      }
      return { ...row, content: decryptDmPlaintext(row.content, secretKey, peerPk) } as T;
    } catch {
      return { ...row, content: '[Unable to decrypt message]' } as T;
    }
  });
}

/** Use with realtime INSERT payloads (no joined sender): decrypts when possible */
export async function decryptRealtimeMessagePayload(
  conversationId: string,
  viewerUserId: string,
  payload: MessageRow
): Promise<MessageRow> {
  const [one] = await decryptMessageContents([payload], conversationId, viewerUserId);
  return one;
}

// Get or create a conversation between two users
export async function getOrCreateConversation(userId1: string, userId2: string) {
  const { data: existingConversations } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId1);

  if (existingConversations && existingConversations.length > 0) {
    const conversationIds = existingConversations.map((c) => c.conversation_id);

    const { data: matchingConversation } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId2)
      .in('conversation_id', conversationIds)
      .single();

    if (matchingConversation) {
      return matchingConversation.conversation_id;
    }
  }

  const { data: newConversation, error: convError } = await supabase
    .from('conversations')
    .insert({})
    .select()
    .single();

  if (convError) throw convError;

  const { error: partError } = await supabase.from('conversation_participants').insert([
    { conversation_id: newConversation.id, user_id: userId1 },
    { conversation_id: newConversation.id, user_id: userId2 },
  ]);

  if (partError) throw partError;

  return newConversation.id;
}

async function unreadCountInConversation(conversationId: string, userId: string): Promise<number> {
  const [rFalse, rNull] = await Promise.all([
    supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('read', false),
    supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .is('read', null),
  ]);
  return (rFalse.count ?? 0) + (rNull.count ?? 0);
}

async function markOthersMessagesReadInConversation(conversationId: string, userId: string) {
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .eq('read', false);
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read', null);
}

// Get all conversations for a user
export async function getConversations(userId: string) {
  const { data: participations, error: partError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  if (partError) throw partError;
  if (!participations || participations.length === 0) return [];

  const conversationIds = participations.map((p) => p.conversation_id);

  const conversations = await Promise.all(
    conversationIds.map(async (convId) => {
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select(
          `
          user_id,
          user:profiles(*)
        `
        )
        .eq('conversation_id', convId)
        .neq('user_id', userId)
        .single();

      const { data: lastMessage } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(*)
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const unreadCount = await unreadCountInConversation(convId, userId);

      let preview = lastMessage;
      if (lastMessage) {
        const [decrypted] = await decryptMessageContents([lastMessage as MessageRow], convId, userId);
        preview = decrypted as typeof lastMessage;
      }

      return {
        id: convId,
        otherUser: participants?.user,
        lastMessage: preview,
        unreadCount,
      };
    })
  );

  return conversations
    .filter((c) => c.lastMessage)
    .sort(
      (a, b) =>
        new Date(b.lastMessage?.created_at || 0).getTime() -
        new Date(a.lastMessage?.created_at || 0).getTime()
    );
}

/**
 * Fetch messages; pass viewerUserId so 1:1 ciphertext is decrypted client-side.
 */
export async function getMessages(conversationId: string, viewerUserId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles(*)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!data?.length) return data ?? [];
  return decryptMessageContents(data as MessageRow[], conversationId, viewerUserId);
}

// Send a message (encrypts for 1:1 Supabase DMs when both users have keys)
export async function sendMessage(conversationId: string, senderId: string, content: string) {
  let storedContent = content;

  if (await shouldUseE2eForConversation(conversationId)) {
    const other = await getOtherParticipantUserId(conversationId, senderId);
    if (!other) {
      throw new Error('Invalid direct message conversation.');
    }
    const peerKeyB64 = await fetchPeerE2ePublicKey(other);
    if (!peerKeyB64) {
      throw new Error(
        'This user cannot receive encrypted messages yet. Ask them to open the app after updating so their device can register encryption keys.'
      );
    }
    const { secretKey } = await getOrCreateE2eIdentity(senderId);
    const peerPk = publicKeyFromBase64(peerKeyB64);
    storedContent = encryptDmPlaintext(content, secretKey, peerPk);
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: storedContent,
      read: false,
    })
    .select(`
      *,
      sender:profiles(*)
    `)
    .single();

  if (error) throw error;

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  const [decrypted] = await decryptMessageContents([data as MessageRow], conversationId, senderId);
  return decrypted;
}

// Mark messages as read (handles read = false or null)
export async function markMessagesAsRead(conversationId: string, userId: string) {
  await markOthersMessagesReadInConversation(conversationId, userId);
}

// Subscribe to new messages in a conversation
export function subscribeToMessages(conversationId: string, callback: (message: unknown) => void) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();
}

// Unsubscribe from messages
export function unsubscribeFromMessages(conversationId: string) {
  supabase.channel(`messages:${conversationId}`).unsubscribe();
}
