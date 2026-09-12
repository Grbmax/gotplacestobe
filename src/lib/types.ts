export type ZoneId = "tepper-2f" | "tepper-3f" | "gates-4f" | "hunt" | "outside";
export type Urgency = "low" | "medium" | "urgent";
export type QuestStatus = "OPEN" | "CLAIMED" | "PENDING" | "CONFIRMED";

export type Zone = {
  id: ZoneId;
  name: string;
  short: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
};

export type Quest = {
  id: string;
  requesterId?: string;
  requesterName: string;
  helperId?: string;
  helperName?: string;
  title: string;
  detail: string;
  zone: ZoneId;
  urgency: Urgency;
  baseKarma: number;
  bonusKarma: number;
  status: QuestStatus;
  createdAt: string;
  updatedAt: number;
};

export type ScoredQuest = Quest & {
  score: number;
  why: string;
  minutesAway: number;
};

export type Session = {
  id: string;
  name: string;
  zone: ZoneId;
  karma: number;
  completed: number;
  bailed: number;
};

export type Transaction = {
  id: string;
  fromUserId?: string;
  toUserId?: string;
  questId?: string;
  label: string;
  amount: number;
  when: string;
};

export type LatLng = { lat: number; lng: number };
