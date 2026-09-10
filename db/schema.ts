import {sqliteTable,text,integer,primaryKey,index} from 'drizzle-orm/sqlite-core';
export const settings=sqliteTable('settings',{id:text('id').primaryKey(),value:text('value').notNull()});
export const progress=sqliteTable('progress',{id:text('id').primaryKey(),done:integer('done').notNull().default(0)});
export const resources=sqliteTable('resources',{id:text('id').primaryKey(),url:text('url').notNull().unique(),title:text('title').notNull(),source:text('source').notNull(),kind:text('kind').notNull(),subject:text('subject').notNull(),year:text('year').notNull(),summary:text('summary').notNull(),collectedAt:text('collected_at').notNull(),origin:text('origin').notNull()});
export const bookmarks=sqliteTable('bookmarks',{id:text('id').primaryKey()});
export const notes=sqliteTable('notes',{id:text('id').primaryKey(),subject:text('subject').notNull(),text:text('text').notNull(),createdAt:text('created_at').notNull()});
export const answers=sqliteTable('answers',{id:text('id').primaryKey(),choice:integer('choice').notNull(),correct:integer('correct').notNull(),updatedAt:text('updated_at').notNull()});


export const authUsers=sqliteTable('auth_users',{id:text('id').primaryKey(),username:text('username').notNull().unique(),displayName:text('display_name').notNull(),passwordHash:text('password_hash').notNull(),role:text('role').notNull().default('member'),invitedBy:text('invited_by').notNull(),createdAt:integer('created_at').notNull()});
export const authInvites=sqliteTable('auth_invites',{id:text('id').primaryKey(),codeHash:text('code_hash').notNull().unique(),prefix:text('prefix').notNull(),label:text('label').notNull(),role:text('role').notNull().default('member'),maxUses:integer('max_uses').notNull(),used:integer('used').notNull().default(0),expiresAt:integer('expires_at').notNull(),revoked:integer('revoked').notNull().default(0),createdAt:integer('created_at').notNull(),createdBy:text('created_by')});
export const authSessions=sqliteTable('auth_sessions',{tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>authUsers.id,{onDelete:'cascade'}),expiresAt:integer('expires_at').notNull(),createdAt:integer('created_at').notNull()},t=>[index('idx_auth_sessions_user').on(t.userId),index('idx_auth_sessions_expires').on(t.expiresAt)]);
export const authLimits=sqliteTable('auth_limits',{id:text('id').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()},t=>[index('idx_auth_limits_expires').on(t.expiresAt)]);
const owner=()=>text('user_id').notNull().references(()=>authUsers.id,{onDelete:'cascade'});
export const userProfiles=sqliteTable('user_profiles',{userId:owner().primaryKey(),value:text('value').notNull()});
export const userProgress=sqliteTable('user_progress',{userId:owner(),id:text('id').notNull(),done:integer('done').notNull().default(0)},t=>[primaryKey({columns:[t.userId,t.id]})]);
export const userBookmarks=sqliteTable('user_bookmarks',{userId:owner(),id:text('id').notNull()},t=>[primaryKey({columns:[t.userId,t.id]})]);
export const userNotes=sqliteTable('user_notes',{userId:owner(),id:text('id').notNull(),subject:text('subject').notNull(),text:text('text').notNull(),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.userId,t.id]}),index('idx_user_notes_created').on(t.userId,t.createdAt)]);
export const userAnswers=sqliteTable('user_answers',{userId:owner(),id:text('id').notNull(),choice:integer('choice').notNull(),correct:integer('correct').notNull(),updatedAt:text('updated_at').notNull()},t=>[primaryKey({columns:[t.userId,t.id]})]);
