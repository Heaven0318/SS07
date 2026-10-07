CREATE TABLE `ss07_daily` (
	`day` text PRIMARY KEY NOT NULL,
	`requests` integer NOT NULL,
	`reserved` integer NOT NULL,
	`actual` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ss07_guard` (
	`ok` integer NOT NULL,
	CONSTRAINT "ss07_guard_ok" CHECK("ss07_guard"."ok" = 1)
);
--> statement-breakpoint
CREATE TABLE `ss07_leases` (
	`id` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ss07_rate` (
	`bucket` integer NOT NULL,
	`subject` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`bucket`, `subject`)
);
