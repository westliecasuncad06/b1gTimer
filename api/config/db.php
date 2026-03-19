<?php
/**
 * B1G Timer — PDO Database Helper (API layer)
 *
 * Task 1.3: "The Heartbeat"
 * Loads the root config.php (which handles .env, timezone, PDO singleton)
 * and re-exports the getPDOInstance() alias that all v1 endpoints call.
 */

require_once dirname(__DIR__, 2) . '/config.php';

/**
 * Backward-compat wrapper — all v1 endpoint files call getPDOInstance().
 */
function getPDOInstance(): PDO {
    return getDB();
}

