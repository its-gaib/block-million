CREATE TABLE `daily_events` (
	`day` text NOT NULL,
	`session` text NOT NULL,
	`event` text NOT NULL,
	`source` text NOT NULL,
	`device` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`day`, `session`, `event`)
);
--> statement-breakpoint
CREATE INDEX `events_day` ON `daily_events` (`day`);