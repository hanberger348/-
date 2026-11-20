CREATE TABLE `game_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `nickname` text NOT NULL,
  `started_at` integer NOT NULL,
  `finished_at` integer,
  `score` integer,
  `duration` real
);
--> statement-breakpoint
CREATE INDEX `game_runs_nickname_score` ON `game_runs` (`nickname`, `score`);
