-- ============================================================================
-- B1G Timer MVP - MySQL Database Schema
-- ============================================================================
-- 
-- Database: b1g_timer_dev (or production equivalent)
-- Charset: utf8mb4 (supports emoji, accents, special characters)
-- Collation: utf8mb4_unicode_ci (case-insensitive, Unicode-compliant)
-- Engine: InnoDB (supports transactions, foreign key constraints)
--
-- Usage: 
--   mysql -u root -p b1g_timer_dev < database/schema.sql
--
-- This schema defines the complete data model for the B1G Timer MVP:
-- - timer_rooms: Event/venue sessions
-- - timer_items: Individual timer segments within a room
--
-- ============================================================================

-- ============================================================================
-- TABLE: timer_rooms
-- ============================================================================
-- Purpose: Stores event/venue session information
-- Role: Parent table for timer_items (one room can have many timers)
-- Indexing: created_at for sorting recent rooms
--

CREATE TABLE IF NOT EXISTS `timer_rooms` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT 'Unique room identifier',
  
  `name` VARCHAR(100) NOT NULL COMMENT 'Event/venue session name (e.g., "B1G Basketball Final")',
  
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when room was created',
  
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Timestamp of last modification (auto-updated)',
  
  -- Indexes for query performance
  INDEX `idx_created_at` (`created_at` DESC) COMMENT 'Sort rooms by creation date (newest first)',
  
  COMMENT = 'Event/venue sessions; parent table for timer rundowns'
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: timer_items
-- ============================================================================
-- Purpose: Stores individual timer segments within a room
-- Role: Child table linked to timer_rooms via foreign key
-- Indexing: Composite (room_id, position) for efficient sorted queries
--

CREATE TABLE IF NOT EXISTS `timer_items` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT 'Unique timer item identifier',
  
  `room_id` INT NOT NULL COMMENT 'Foreign key to timer_rooms (references parent room)',
  
  `title` VARCHAR(100) NOT NULL COMMENT 'Timer segment name (e.g., "Opening Ceremony", "Session 1")',
  
  `duration_seconds` INT NOT NULL COMMENT 'Timer duration in seconds (0-36000 = 0-10 hours max per spec)',
  
  `position` INT NOT NULL COMMENT 'Order in queue (1-indexed; calculated by application during reorder)',
  
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when timer was created',
  
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Timestamp of last modification',
  
  -- Foreign Key: Links to timer_rooms
  CONSTRAINT `fk_timer_items_room_id` 
    FOREIGN KEY (`room_id`) 
    REFERENCES `timer_rooms` (`id`) 
    ON DELETE CASCADE COMMENT 'Cascade delete: removing room deletes all timers',
  
  -- Composite Index: Efficient fetch of room timers in correct order
  INDEX `idx_room_id_position` (`room_id`, `position`) COMMENT 'Composite index for efficient sorted room timer queries',
  
  -- Single Index: Fallback for room-only lookups
  INDEX `idx_room_id` (`room_id`) COMMENT 'Single index for room lookups (fallback if composite not used)',
  
  COMMENT = 'Individual timer segments; child table linked to timer_rooms'
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VERIFICATION QUERIES (Run after schema creation to verify)
-- ============================================================================
-- 
-- Verify tables were created:
--   SHOW TABLES;
--
-- Verify timer_rooms schema:
--   DESCRIBE timer_rooms;
--
-- Verify timer_items schema:
--   DESCRIBE timer_items;
--
-- Verify indexes:
--   SHOW INDEX FROM timer_rooms;
--   SHOW INDEX FROM timer_items;
--
-- Verify foreign key constraint:
--   SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME
--   FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
--   WHERE TABLE_SCHEMA = 'b1g_timer_dev';
--
-- ============================================================================

-- ============================================================================
-- SCHEMA DESIGN RATIONALE
-- ============================================================================
--
-- 1. Charset & Collation: utf8mb4_unicode_ci
--    - Supports emoji, accents, international characters
--    - Case-insensitive for room/timer names (user-friendly)
--    - Unicode-compliant (proper character handling)
--
-- 2. Engine: InnoDB
--    - Supports ACID transactions (important for consistency)
--    - Foreign key constraints (enforces referential integrity)
--    - Row-level locking (better concurrency than MyISAM)
--
-- 3. Foreign Key: ON DELETE CASCADE
--    - Deleting a room automatically deletes all its timers
--    - Prevents orphaned timer records
--    - Simplifies application logic (no need for manual cascade)
--
-- 4. Composite Index: (room_id, position)
--    - Optimizes query: SELECT * FROM timer_items WHERE room_id=X ORDER BY position
--    - Target: <200ms fetch time (from success criteria FR14)
--    - Covers both WHERE (room_id) and ORDER BY (position) clauses
--
-- 5. Auto-increment IDs
--    - Simple, fast primary keys
--    - No UUID complexity for MVP
--    - Sequential IDs sufficient for <1000 rooms
--    - Can migrate to UUID in Phase 2 if needed
--
-- 6. Timestamps (created_at, updated_at)
--    - created_at: Track when room/timer created (immutable)
--    - updated_at: Track last modification (auto-updated on INSERT/UPDATE)
--    - Useful for debugging, audit trails, sorting (newest first)
--
-- ============================================================================

-- ============================================================================
-- SCALABILITY NOTES (from MVP analysis)
-- ============================================================================
--
-- MVP Targets (from Task analysis/roadmap):
-- - Max 100 timers per room
-- - Max 5 concurrent dashboards per room
-- - Max 100 daily active rooms
-- - Success criterion: 1000+ rooms scalability
--
-- This schema supports:
-- ✅ 100 timers/room: No issues (INT for position, room_id)
-- ✅ 1000+ rooms: Efficient with indexes (composite + single)
-- ✅ Concurrent reads/writes: InnoDB handles well
-- ✅ Query performance: Composite index ensures <200ms (FR14 target)
--
-- Phase 2 Considerations (not implemented in MVP):
-- - UUID primary keys (if distributed system needed)
-- - Audit table (track all changes for compliance)
-- - Soft deletes (mark deleted without removing)
-- - Partitioning by room_id (if >10M rows)
--
-- ============================================================================
