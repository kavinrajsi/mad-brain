import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const brandRole = pgEnum("brand_role", ["owner", "admin", "member"]);

export const documentSourceType = pgEnum("document_source_type", [
  "upload",
  "url",
  "note",
  "profile",
]);

export const documentStatus = pgEnum("document_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const brands = pgTable("brands", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// id is the Firebase uid — rows are created on first successful sign-in.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoUrl: text("photo_url"),
  preferredModel: text("preferred_model"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const brandMembers = pgTable(
  "brand_members",
  {
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: brandRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.brandId, t.userId] }),
    index("brand_members_user_idx").on(t.userId),
  ],
);

// Firebase provides sign-in, not brand membership. An invite is what turns a
// new hire into a member — consumed once, on their first sign-in.
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: brandRole("role").notNull().default("member"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("invites_email_idx").on(t.email)],
);

// The scoring rubric. Kept structured so the same idea scores comparably
// across runs, rather than against whatever RAG happens to retrieve.
export const brandProfiles = pgTable("brand_profiles", {
  brandId: uuid("brand_id")
    .primaryKey()
    .references(() => brands.id, { onDelete: "cascade" }),
  mission: text("mission"),
  values: jsonb("values").default([]),
  tone: jsonb("tone").default([]),
  audience: text("audience"),
  dos: jsonb("dos").default([]),
  donts: jsonb("donts").default([]),
  visual: jsonb("visual").default([]),
  // Kapferer prism: { physique, personality, culture, relationship,
  // reflection, selfImage } — free text per facet.
  prism: jsonb("prism").default({}),
  // Rule book: hard rules, one string each. Rendered into the profile
  // document and the fit-check rubric alongside the dos/don'ts.
  rules: jsonb("rules").default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sourceType: documentSourceType("source_type").notNull(),
    blobUrl: text("blob_url"),
    sourceUrl: text("source_url"),
    mime: text("mime"),
    // Source text for notes and the generated brand-profile document. Kept
    // separate from document_chunks so re-ingesting can safely delete every
    // chunk without destroying the original.
    body: text("body"),
    status: documentStatus("status").notNull().default("pending"),
    error: text("error"),
    // Curated onboarding order for the brand's "Start here" reading path.
    pinnedOrder: integer("pinned_order"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("documents_brand_status_idx").on(t.brandId, t.status),
    index("documents_brand_pinned_idx").on(t.brandId, t.pinnedOrder),
  ],
);

// Chunk text lives here, not in Pinecone metadata. Pinecone returns ids and
// scores; citations are rendered from these rows so they can be trusted.
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    pineconeId: text("pinecone_id").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("document_chunks_document_idx").on(t.documentId, t.ordinal),
    index("document_chunks_brand_idx").on(t.brandId),
  ],
);

export const documentReads = pgTable(
  "document_reads",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.documentId] })],
);

// Not just a log — new joiners browse past verdicts to learn what fits.
export const ideaChecks = pgTable(
  "idea_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ideaText: text("idea_text").notNull(),
    modelId: text("model_id").notNull(),
    overallScore: integer("overall_score"),
    verdict: jsonb("verdict"),
    citations: jsonb("citations"),
    usage: jsonb("usage"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idea_checks_brand_created_idx").on(t.brandId, t.createdAt)],
);

// Every Ask conversation is kept, for the same reason idea_checks is: past
// answers are how new joiners learn where the brand's edges are.
export const chats = pgTable(
  "chats",
  {
    // Client-generated per conversation, so the id must never be trusted to
    // prove ownership — writes verify brand_id against the session first.
    id: uuid("id").primaryKey(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    modelId: text("model_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("chats_brand_updated_idx").on(t.brandId, t.updatedAt)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    // AI SDK message id. Scoped to the chat rather than globally unique so a
    // colliding (or forged) client id can never block another chat's insert.
    id: text("id").notNull(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    parts: jsonb("parts").notNull(),
    metadata: jsonb("metadata"),
    ordinal: integer("ordinal").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.chatId, t.id] }),
    index("chat_messages_chat_ordinal_idx").on(t.chatId, t.ordinal),
  ],
);
