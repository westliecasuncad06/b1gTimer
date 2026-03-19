<?php
/**
 * GET /api/v1/pusher-config
 *
 * Returns the public Pusher key + cluster so the frontend JS can
 * initialize the Pusher client without hard-coding credentials.
 * The secret is NEVER exposed here.
 */

require_once dirname(__DIR__) . '/config/db.php';
require_once dirname(__DIR__) . '/utils/error-handler.php';

header('Access-Control-Allow-Origin: *');
setJsonHeader();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError(ERROR_INVALID_INPUT, 'Only GET allowed', HTTP_METHOD_NOT_ALLOWED);
}

$cfg = getPusherConfig();

sendSuccess([
    'key'     => $cfg['key'],
    'cluster' => $cfg['cluster'],
]);
