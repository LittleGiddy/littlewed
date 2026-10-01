// app/client/events/[id]/contributions/types.ts
// Shapes returned by /api/events/[eventId]/contributions.
//
// The row list is every guest on the event, not just the ones who have been
// reminded, so `hasContribution` distinguishes a tracked guest from one whose
// row does not exist yet.
import type { ContributionStatus } from '@/lib/contributions';

export interface ManagerEvent {
  id: string;
  name: string;
  date: string;
  venue: string;
  address: string;
  person1: string | null;
  person2: string | null;
  hostFamily: string | null;
  contributionsEnabled: boolean;
  eventType: string | null;
  contributionDeadline: string | null;
  contributionTarget: number | null;
  contributionCurrency: string | null;
  mpesaInstructions: string | null;
  airtelInstructions: string | null;
  bankInstructions: string | null;
}

export interface ManagerRow {
  id: string;
  guestId: string;
  guestName: string;
  phone: string | null;
  phoneMasked: string;
  status: ContributionStatus;
  amountPaid: number;
  amountExpected: number | null;
  note: string | null;
  updatedByName: string | null;
  remindedAt: string | null;
  remindedCount: number;
  updatedAt: string | null;
  hasContribution: boolean;
}

export interface ManagerSummary {
  total: number;
  pending: number;
  partial: number;
  paid: number;
  settled: number;
  outstanding: number;
  collected: number;
  target: number | null;
  currency: string;
}

export interface ManagerPayload {
  event: ManagerEvent;
  summary: ManagerSummary;
  rows: ManagerRow[];
}

export interface SettingsForm {
  contributionsEnabled: boolean;
  eventType: string;
  contributionDeadline: string;
  contributionTarget: string;
  contributionCurrency: string;
  mpesaInstructions: string;
  airtelInstructions: string;
  bankInstructions: string;
}

export type Screen = 'overview' | 'guests' | 'settings';
export type StatusFilter = 'ALL' | ContributionStatus;
