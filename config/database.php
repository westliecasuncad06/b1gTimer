<?php
/**
 * B1G Timer MVP - Database Configuration & Connection
 * 
 * Loads environment variables from .env file and establishes PDO connection.
 * Called once at application bootstrap.
 * 
 * Usage:
 *   require_once __DIR__ . '/../config/database.php';
 *   $pdo = createDatabaseConnection();
 */

// =============================================================================
// LOAD ENVIRONMENT VARIABLES
// =============================================================================

/**
 * Load .env file and populate $_ENV and getenv()
 * Simple implementation (not using vlucas/phpdotenv for MVP to minimize dependencies)
 */
function loadEnvironmentFile($envPath) {
    if (!file_exists($envPath)) {
        throw new Exception("Environment file not found: {$envPath}");
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    foreach ($lines as $line) {
        // Skip comments
        if (strpos(trim($line), '#') === 0) {
            continue;
        }

        // Parse KEY=VALUE
        if (strpos($line, '=') === false) {
            continue;
        }

        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);

        // Remove quotes if present
        if ((strpos($value, '"') === 0 && strrpos($value, '"') === strlen($value) - 1) ||
            (strpos($value, "'") === 0 && strrpos($value, "'") === strlen($value) - 1)) {
            $value = substr($value, 1, -1);
        }

        // Set environment variable
        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
    }
}

// Load .env file relative to project root
$env_file = dirname(__DIR__) . '/.env';
if (file_exists($env_file)) {
    loadEnvironmentFile($env_file);
}

// =============================================================================
// LOAD CONSTANTS
// =============================================================================

// Load application constants (depends on .env being loaded first)
require_once __DIR__ . '/constants.php';

// =============================================================================
// CREATE PDO CONNECTION
// =============================================================================

/**
 * Create and return a configured PDO database connection
 * 
 * @return PDO Database connection object
 * @throws Exception If connection fails or environment variables missing
 */
function createDatabaseConnection() {
    // Retrieve database credentials from environment
    $db_host = getenv('DB_HOST') ?: 'localhost';
    $db_port = getenv('DB_PORT') ?: 3306;
    $db_user = getenv('DB_USER') ?: 'root';
    $db_password = getenv('DB_PASSWORD') ?: '';
    $db_name = getenv('DB_NAME');

    // Validate required configuration
    if (!$db_name) {
        throw new Exception('DB_NAME environment variable not configured');
    }

    try {
        // Build DSN (Data Source Name)
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $db_host,
            $db_port,
            $db_name
        );

        // Create PDO connection with options
        $pdo = new PDO(
            $dsn,
            $db_user,
            $db_password,
            [
                // Set error mode to exceptions (throw on error)
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                
                // Ensures strings are fetched as associative arrays by default
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                
                // Set character set to UTF-8 (supports emoji, special chars)
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
                
                // Timeout for long-running queries (prevent hanging)
                PDO::ATTR_TIMEOUT => 30,
            ]
        );

        // Test connection
        $pdo->query('SELECT 1');

        return $pdo;

    } catch (PDOException $e) {
        $error_message = APP_DEBUG
            ? "Database Connection Error: " . $e->getMessage()
            : "Database connection failed. Please check configuration.";

        if (APP_DEBUG) {
            error_log($error_message);
        }

        throw new Exception($error_message, 0, $e);
    }
}

/**
 * Execute a prepared statement safely
 * 
 * Helper function to wrap PDO prepared statements with error handling.
 * Prevents SQL injection by enforcing parameterized queries.
 * 
 * @param PDO $pdo Database connection
 * @param string $sql Parameterized SQL query (e.g., "SELECT * FROM rooms WHERE id = ?")
 * @param array $params Query parameters (e.g., [123])
 * @return PDOStatement Executed statement
 * @throws Exception On query error
 */
function executePreparedStatement(PDO $pdo, $sql, $params = []) {
    try {
        $stmt = $pdo->prepare($sql);
        
        if (!$stmt) {
            throw new Exception("Failed to prepare statement: " . implode(', ', $pdo->errorInfo()));
        }

        if (!$stmt->execute($params)) {
            throw new Exception("Failed to execute statement: " . implode(', ', $stmt->errorInfo()));
        }

        return $stmt;

    } catch (Exception $e) {
        if (APP_DEBUG) {
            error_log("SQL Error: {$sql} | Params: " . json_encode($params) . " | Error: " . $e->getMessage());
        }
        throw new Exception("Database query failed", HTTP_INTERNAL_SERVER_ERROR, $e);
    }
}

/**
 * Global PDO instance (lazy-loaded on first access)
 * 
 * Usage: $pdo = getPDOInstance();
 */
$_pdo_instance = null;

function getPDOInstance() {
    global $_pdo_instance;
    
    if ($_pdo_instance === null) {
        $_pdo_instance = createDatabaseConnection();
    }
    
    return $_pdo_instance;
}

// =============================================================================
// TIMEZONE SETUP
// =============================================================================

/**
 * Set default timezone for date/time functions
 * Uses SERVER_TIMEZONE from .env (typically UTC)
 */
date_default_timezone_set(SERVER_TIMEZONE);

// =============================================================================
// CONNECTION READY
// =============================================================================

// If script reaches here without exceptions, database is configured and ready
// Applications using this file can immediately call getPDOInstance() or createDatabaseConnection()

?>
