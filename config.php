<?php
/**
 * B1G Timer — Master Configuration (Task 1.3: "The Heartbeat")
 *
 * Single entry-point that:
 *   1. Loads .env credentials
 *   2. Sets Asia/Manila timezone
 *   3. Creates a reliable PDO singleton
 *   4. Exposes Pusher keys for the broadcast layer
 *
 * Every other PHP file should:
 *   require_once __DIR__ . '/../../config.php';   (adjust depth)
 * and then call  getDB()  or  getPusherConfig().
 */

// ── 1. Load .env ────────────────────────────────────────────────────────────
$envPath = __DIR__ . '/.env';
if (file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key   = trim($key);
        $value = trim($value);
        // Strip surrounding quotes
        if (preg_match('/^([\'"])(.*)\1$/', $value, $m)) {
            $value = $m[2];
        }
        putenv("$key=$value");
        $_ENV[$key] = $value;
    }
}

// ── 2. Timezone ─────────────────────────────────────────────────────────────
date_default_timezone_set(getenv('VENUE_TIMEZONE') ?: 'Asia/Manila');

// ── 3. Environment flag ─────────────────────────────────────────────────────
if (!defined('APP_ENV'))   define('APP_ENV',   getenv('PHP_ENVIRONMENT') ?: 'development');
if (!defined('APP_DEBUG')) define('APP_DEBUG', APP_ENV === 'development');

if (APP_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

// ── 4. PDO Database Connection (singleton) ──────────────────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $host = getenv('DB_HOST') ?: 'localhost';
    $port = getenv('DB_PORT') ?: 3306;
    $name = getenv('DB_NAME') ?: 'b1g_timer_dev';
    $user = getenv('DB_USER') ?: 'root';
    $pass = getenv('DB_PASSWORD') ?: '';

    $dsn = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";

    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
    ]);

    return $pdo;
}

// ── 5. Pusher Configuration ─────────────────────────────────────────────────
function getPusherConfig(): array {
    return [
        'key'     => getenv('PUSHER_KEY')     ?: '',
        'secret'  => getenv('PUSHER_SECRET')  ?: '',
        'cluster' => getenv('PUSHER_CLUSTER') ?: 'ap1',
    ];
}

/**
 * Trigger a Pusher event via the REST API (no SDK required).
 * Uses cURL so we avoid Composer/vendor dependencies on InfinityFree.
 */
function pusherTrigger(string $channel, string $event, array $data): bool {
    $cfg = getPusherConfig();
    if (empty($cfg['key']) || empty($cfg['secret'])) return false;

    $appId   = getenv('PUSHER_APP_ID') ?: '';
    $body    = json_encode(['name' => $event, 'channel' => $channel, 'data' => json_encode($data)]);
    $path    = "/apps/$appId/events";
    $ts      = time();
    $params  = [
        'auth_key'       => $cfg['key'],
        'auth_timestamp' => $ts,
        'auth_version'   => '1.0',
        'body_md5'       => md5($body),
    ];
    ksort($params);
    $query   = http_build_query($params);
    $sigStr  = "POST\n$path\n$query";
    $sig     = hash_hmac('sha256', $sigStr, $cfg['secret']);
    $url     = "https://api-{$cfg['cluster']}.pusher.com{$path}?{$query}&auth_signature={$sig}";

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
    ]);
    $result = curl_exec($ch);
    $code   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $code >= 200 && $code < 300;
}
