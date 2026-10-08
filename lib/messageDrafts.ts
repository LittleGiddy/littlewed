'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Account-scoped message drafts ─────────────────────────────────────────
// The invitation and reminder composers used to keep whatever the user typed
// in this browser's localStorage, so a second device (or a colleague on the
// same account) started from nothing. These values now live on the Event row
// - which belongs to a tenant - and this hook is the single client-side
// reader/writer for them. localStorage is only consulted once, to carry a
// draft that predates this change up to the account.

export interface WhatsappInviteDraft {
  template?: string;
  vars?: Record<string, string>;
  contact?: string;
  contact2?: string;
  eventType?: string;
}

export interface MessageDrafts {
  smsTemplate: string | null;
  whatsappInviteDraft: WhatsappInviteDraft | null;
  whatsappDailyLimit: number | null;
  reminderSmsMessage: string | null;
  kumbushaMessage: string | null;
}

export type DraftKey = keyof MessageDrafts;
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const EMPTY: MessageDrafts = {
  smsTemplate: null,
  whatsappInviteDraft: null,
  whatsappDailyLimit: null,
  reminderSmsMessage: null,
  kumbushaMessage: null,
};

const FIELD_BY_KEY: Record<DraftKey, string> = {
  smsTemplate: 'smsInviteTemplate',
  whatsappInviteDraft: 'whatsappInviteDraft',
  whatsappDailyLimit: 'whatsappDailyLimit',
  reminderSmsMessage: 'reminderSmsMessage',
  kumbushaMessage: 'kumbushaMessage',
};

const SAVE_DEBOUNCE_MS = 450;

/** Drafts written by earlier versions of the app, still on this device. */
function readLegacyDrafts(eventId: string): Partial<MessageDrafts> {
  const found: Partial<MessageDrafts> = {};
  try {
    const sms = localStorage.getItem(`sms_template_${eventId}`);
    if (sms) {
      const parsed = JSON.parse(sms);
      if (typeof parsed?.template === 'string' && parsed.template.trim()) {
        found.smsTemplate = parsed.template;
      }
    }
    const wa = localStorage.getItem(`whatsapp_draft_${eventId}`);
    if (wa) {
      const parsed = JSON.parse(wa);
      if (parsed && typeof parsed === 'object' && typeof parsed.template === 'string') {
        found.whatsappInviteDraft = parsed;
      }
    }
    const limit = parseInt(localStorage.getItem(`wa_daily_limit_${eventId}`) || '', 10);
    if (limit > 0) found.whatsappDailyLimit = limit;
    const reminder = localStorage.getItem(`reminder_sms_draft_${eventId}`);
    if (reminder && reminder.trim()) found.reminderSmsMessage = reminder;
  } catch {
    // ignore unreadable/corrupt values
  }
  return found;
}

export function useMessageDrafts(eventId?: string) {
  const [drafts, setDrafts] = useState<MessageDrafts>(EMPTY);
  const [ready, setReady] = useState(() => !eventId);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const eventIdRef = useRef<string | undefined>(eventId);
  const pending = useRef<Partial<MessageDrafts>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    eventIdRef.current = eventId;
  }, [eventId]);

  const flush = useCallback(async () => {
    const id = eventIdRef.current;
    const body = pending.current;
    if (!id || Object.keys(body).length === 0) return;
    const payload: Record<string, unknown> = {};
    for (const key of Object.keys(body) as DraftKey[]) {
      payload[FIELD_BY_KEY[key]] = body[key];
    }
    pending.current = {};
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/events/${id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSaveStatus(current => (Object.keys(pending.current).length > 0 ? current : 'saved'));
    } catch {
      // Keep the values so the retry effect or the next change sends them again.
      pending.current = { ...body, ...pending.current };
      setSaveStatus('error');
    }
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void flush();
    }, SAVE_DEBOUNCE_MS);
  }, [flush]);

  const set = useCallback(
    <K extends DraftKey>(key: K, value: MessageDrafts[K]) => {
      setDrafts(prev => ({ ...prev, [key]: value }));
      pending.current = { ...pending.current, [key]: value };
      schedule();
    },
    [schedule]
  );

  // Load the account copy once, migrating any draft this device had stored
  // before the switch to server-side saving.
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      const fromServer: Partial<MessageDrafts> = {};
      try {
        const res = await fetch(`/api/events/${eventId}/settings`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.smsInviteTemplate === 'string') fromServer.smsTemplate = data.smsInviteTemplate;
          if (data.whatsappInviteDraft && typeof data.whatsappInviteDraft === 'object') {
            fromServer.whatsappInviteDraft = data.whatsappInviteDraft as WhatsappInviteDraft;
          }
          if (typeof data.whatsappDailyLimit === 'number' && data.whatsappDailyLimit > 0) {
            fromServer.whatsappDailyLimit = data.whatsappDailyLimit;
          }
          if (typeof data.reminderSmsMessage === 'string') fromServer.reminderSmsMessage = data.reminderSmsMessage;
          if (typeof data.kumbushaMessage === 'string') fromServer.kumbushaMessage = data.kumbushaMessage;
        }
      } catch {
        // Offline: still show whatever this device remembers.
      }

      const legacy = readLegacyDrafts(eventId);
      const migrated: Partial<MessageDrafts> = {};
      for (const key of Object.keys(legacy) as DraftKey[]) {
        const serverValue = fromServer[key];
        if ((serverValue === undefined || serverValue === null) && legacy[key] !== undefined) {
          (migrated as Record<string, unknown>)[key] = legacy[key];
        }
      }

      if (cancelled) return;
      setDrafts({ ...EMPTY, ...fromServer, ...migrated });
      if (Object.keys(migrated).length > 0) {
        pending.current = { ...migrated };
        void flush();
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, flush]);

  // Give a failed save another chance a few seconds later - and again after
  // every failed attempt - so a typed draft survives a server hiccup.
  useEffect(() => {
    if (saveStatus !== 'error' || Object.keys(pending.current).length === 0) return;
    const retry = setTimeout(() => {
      void flush();
    }, 5000);
    return () => clearTimeout(retry);
  }, [saveStatus, flush]);

  // Never lose a keystroke: flush whatever is pending when the screen unmounts.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  // Retry an earlier failed save the next time the tab comes back online.
  useEffect(() => {
    const retry = () => {
      if (Object.keys(pending.current).length > 0) void flush();
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [flush]);

  return { drafts, ready, saveStatus, set, flush };
}