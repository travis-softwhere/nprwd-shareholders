import { integer, pgTable, serial, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core"

export const meetings = pgTable("meetings", {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    date: timestamp("date").notNull(),
    totalShareholders: integer("total_shareholders").default(0),
    checkedIn: integer("checked_in").default(0),
    dataSource: text("data_source").notNull().default("excel"),
    hasInitialData: boolean("has_initial_data").default(false),
    mailersGenerated: boolean("mailers_generated").default(false),
    mailerGenerationDate: timestamp("mailer_generation_date"),
    createdAt: timestamp("created_at").defaultNow(),
})

export const shareholders = pgTable("shareholders", {
    id: serial("id").primaryKey(),
    shareholderId: text("shareholder_id").notNull().unique(),
    name: text("name").notNull(),
    meetingId: text("meeting_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
})

export const properties = pgTable("properties", {
    id: serial("id").primaryKey(),
    account: text("account").notNull(),
    shareholderId: text("shareholder_id").notNull(),
    numOf: text("num_of"),
    customerName: text("customer_name"),
    customerMailingAddress: text("customer_mailing_address"),
    cityStateZip: text("city_state_zip"),
    ownerName: text("owner_name"),
    ownerMailingAddress: text("owner_mailing_address"),
    ownerCityStateZip: text("owner_city_state_zip"),
    residentName: text("resident_name"),
    residentMailingAddress: text("resident_mailing_address"),
    residentCityStateZip: text("resident_city_state_zip"),
    serviceAddress: text("service_address"),
    checkedIn: boolean("checked_in").default(false),
    createdAt: timestamp("created_at").defaultNow(),
})

// New table for tracking data snapshots
export const snapshots = pgTable("snapshots", {
    id: serial("id").primaryKey(),
    meetingId: text("meeting_id").notNull(),
    snapshotDate: timestamp("snapshot_date").defaultNow(),
    type: text("type").notNull(), // 'initial', 'mailer', 'update'
    data: jsonb("data").notNull(), // Stores the full snapshot data
    changes: jsonb("changes"), // Stores changes from previous snapshot
    createdAt: timestamp("created_at").defaultNow(),
})