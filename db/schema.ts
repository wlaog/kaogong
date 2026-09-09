import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const settings=sqliteTable('settings',{id:text('id').primaryKey(),value:text('value').notNull()});
export const progress=sqliteTable('progress',{id:text('id').primaryKey(),done:integer('done').notNull().default(0)});
export const resources=sqliteTable('resources',{id:text('id').primaryKey(),url:text('url').notNull().unique(),title:text('title').notNull(),source:text('source').notNull(),kind:text('kind').notNull(),subject:text('subject').notNull(),year:text('year').notNull(),summary:text('summary').notNull(),collectedAt:text('collected_at').notNull(),origin:text('origin').notNull()});
export const bookmarks=sqliteTable('bookmarks',{id:text('id').primaryKey()});
export const notes=sqliteTable('notes',{id:text('id').primaryKey(),subject:text('subject').notNull(),text:text('text').notNull(),createdAt:text('created_at').notNull()});
export const answers=sqliteTable('answers',{id:text('id').primaryKey(),choice:integer('choice').notNull(),correct:integer('correct').notNull(),updatedAt:text('updated_at').notNull()});

