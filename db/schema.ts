import { sqliteTable,text,integer,primaryKey,check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const daily=sqliteTable('ss07_daily',{day:text().primaryKey(),requests:integer().notNull(),reserved:integer().notNull(),actual:integer().notNull()});
export const rate=sqliteTable('ss07_rate',{bucket:integer().notNull(),subject:text().notNull(),count:integer().notNull()},t=>[primaryKey({columns:[t.bucket,t.subject]})]);
export const leases=sqliteTable('ss07_leases',{id:text().primaryKey(),expires:integer().notNull()});
export const guard=sqliteTable('ss07_guard',{ok:integer().notNull()},t=>[check('ss07_guard_ok',sql`${t.ok} = 1`)]);
