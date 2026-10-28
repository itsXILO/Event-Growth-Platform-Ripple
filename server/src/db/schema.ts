import {
  pgTable,
  text,
  integer,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const communityTypeEnum = pgEnum("community_type", ["college", "club"]);

export const registrationSourceEnum = pgEnum("registration_source", [
  "direct",
  "referral",
  "club_link",
]);

// ── events ────────────────────────────────────────────────────────────────────

export const events = pgTable("events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── communities ───────────────────────────────────────────────────────────────

export const communities = pgTable("communities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  type: communityTypeEnum("type").notNull(),
  // Non-null only when type = 'club'; references the parent college
  parentCollegeId: integer("parent_college_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── registrations ─────────────────────────────────────────────────────────────

export const registrations = pgTable(
  "registrations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    collegeId: integer("college_id")
      .notNull()
      .references(() => communities.id),
    // Nullable – only set when registrant signed up via a club link
    communityId: integer("community_id").references(() => communities.id),
    semester: integer("semester").notNull(),
    branch: text("branch").notNull(),
    // Every registrant gets a unique shareable referral code
    referralCode: text("referral_code").notNull().unique(),
    // Points to the registration whose link brought this person in
    referredByRegistrationId: integer("referred_by_registration_id"),
    source: registrationSourceEnum("source").notNull().default("direct"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One email per event – prevents duplicate registrations
    unique("uq_registrations_event_email").on(table.eventId, table.email),
  ]
);

// ── Types (inferred) ──────────────────────────────────────────────────────────

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;

export type Registration = typeof registrations.$inferSelect;
export type NewRegistration = typeof registrations.$inferInsert;
