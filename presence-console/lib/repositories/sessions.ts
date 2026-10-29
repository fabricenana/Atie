import "server-only";
import type { ID } from "../domain/types";
import { readStore } from "../demo/store";

/** Lectures spécifiques aux écrans Conversations / Sessions. */

export function getConversation(id: ID) {
  const s = readStore();
  const conversation = s.conversations.find((c) => c.id === id) ?? null;
  if (!conversation) return null;
  return {
    conversation,
    organization: s.organizations.find((o) => o.id === conversation.organizationId) ?? null,
    receptionist: s.receptionists.find((r) => r.id === conversation.receptionistId) ?? null,
    events: s.conversationEvents.filter((e) => e.conversationId === id).sort((a, b) => a.at.localeCompare(b.at)),
  };
}

/** Index nom par identifiant pour les tableaux. */
export function nameIndexes() {
  const s = readStore();
  return {
    orgs: new Map(s.organizations.map((o) => [o.id, o])),
    receptionists: new Map(s.receptionists.map((r) => [r.id, r])),
  };
}
