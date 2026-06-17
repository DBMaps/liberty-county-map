-- V410 rollback migration artifact only. Do not execute as part of this milestone.
-- Removes only V410 history_capture storage artifacts.

drop table if exists history_capture.retention_runs;
drop table if exists history_capture.writer_monitoring_events;
drop table if exists history_capture.historical_events;
drop schema if exists history_capture;
