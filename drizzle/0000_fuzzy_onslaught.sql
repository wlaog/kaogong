CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`choice` integer NOT NULL,
	`correct` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `progress` (
	`id` text PRIMARY KEY NOT NULL,
	`done` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`year` text NOT NULL,
	`summary` text NOT NULL,
	`collected_at` text NOT NULL,
	`origin` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resources_url_unique` ON `resources` (`url`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
