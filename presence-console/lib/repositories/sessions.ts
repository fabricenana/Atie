import "server-only";
import type { Conversation, ConversationEvent, ID, Organization, Receptionist } from "../domain/types";
import { isUuid, one, rows } from "../db";
import { read } from "../db/scope";
import { CONVERSATION_COLS, EVENT_COLS, ORG_COLS, RECEPTIONIST_COLS } from "./sql";

/** Lectures spécifiques aux écrans Conversations / Sessions (back-office). */

export async function getConversation(id: ID) {
  if (!isUuid(id)) return null;
  return read(async (q) => {
    const conversation = await one<Conversation>(q, `SELECT ${CONVERSATION_COLS} FROM conversations c WHERE c.id = $1`, [id]);
    if (!conversation) return null;
    const organization = await one<Organization>(q, `SELECT ${ORG_COLS} FROM organizations o WHERE o.id = $1`, [conversation.organizationId]);
    const receptionist = conversation.receptionistId
      ? await one<Receptionist>(q, `SELECT ${RECEPTIONIST_COLS} FROM receptionists r WHERE r.id = $1`, [conversation.receptionistId])
      : null;
    const events = await rows<ConversationEvent>(q, `SELECT ${EVENT_COLS} FROM conversation_events e WHERE e.conversation_id = $1 ORDER BY e.at`, [id]);
    return { conversation, organization, receptionist, events };
  });
}

/** Index par identifiant pour les tableaux. */
export async function nameIndexes() {
  return read(async (q) => {
    const orgs = await rows<Organization>(q, `SELECT ${ORG_COLS} FROM organizations o`);
    const receptionists = await rows<Receptionist>(q, `SELECT ${RECEPTIONIST_COLS} FROM receptionists r`);
    return {
      orgs: new Map(orgs.map((o) => [o.id, o])),
      receptionists: new Map(receptionists.map((r) => [r.id, r])),
    };
  });
}
