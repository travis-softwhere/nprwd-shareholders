import { integer, pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core"

export const shareholders = pgTable("shareholders", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    meetingId: text("meeting_id").notNull(),
    shareholderId: text("shareholder_id").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow(),
})

export const properties = pgTable("properties", {
    id: serial("id").primaryKey(),
    account: text("account").notNull(),
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
    shareholderId: text("shareholder_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
})

export const meetings = pgTable("meetings", {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    date: timestamp("date").notNull(),
    totalShareholders: integer("total_shareholders").default(0),
    checkedIn: integer("checked_in").default(0),
})