<?php
/**
 * B1G Timer - Bible Background Image Upload API
 *
 * Routes:
 *   GET    /api/v1/bible-bg   - List uploaded backgrounds
 *   POST   /api/v1/bible-bg   - Upload a background image
 *   DELETE /api/v1/bible-bg/{filename} - Delete a background
 */

require_once dirname(__DIR__) . '/utils/error-handler.php';

setJsonHeader();

$uploadDir = dirname(__DIR__, 2) . '/public/uploads/bible-bg';

// Ensure upload directory exists
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $path   = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $parts  = array_values(array_filter(explode('/', $path)));

    // Find filename after "bible-bg"
    $filename = null;
    foreach ($parts as $i => $seg) {
        if ($seg === 'bible-bg' && isset($parts[$i + 1])) {
            $filename = $parts[$i + 1];
            break;
        }
    }

    switch ($method) {
        case 'GET':
            handleListBackgrounds($uploadDir);
            break;
        case 'POST':
            handleUploadBackground($uploadDir);
            break;
        case 'DELETE':
            if ($filename) {
                handleDeleteBackground($uploadDir, $filename);
            } else {
                sendError(ERROR_INVALID_INPUT, 'DELETE requires a filename', HTTP_BAD_REQUEST);
            }
            break;
        default:
            sendError(ERROR_INVALID_INPUT, "Method '$method' not supported", HTTP_METHOD_NOT_ALLOWED);
    }
} catch (Exception $e) {
    sendError(ERROR_INTERNAL_ERROR, $e->getMessage(), HTTP_INTERNAL_SERVER_ERROR);
}

function handleListBackgrounds($uploadDir) {
    $files = [];
    $allowed = ['jpg', 'jpeg', 'png', 'webp'];

    if (is_dir($uploadDir)) {
        foreach (scandir($uploadDir) as $f) {
            if ($f === '.' || $f === '..') continue;
            $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
            if (in_array($ext, $allowed)) {
                $files[] = [
                    'filename' => $f,
                    'url' => 'uploads/bible-bg/' . $f,
                    'size' => filesize($uploadDir . '/' . $f)
                ];
            }
        }
    }
    sendSuccess($files);
}

function handleUploadBackground($uploadDir) {
    if (empty($_FILES['image'])) {
        sendError(ERROR_INVALID_INPUT, 'No image file uploaded. Use field name "image"', HTTP_BAD_REQUEST);
    }

    $file = $_FILES['image'];

    // Validate file size (5MB max)
    if ($file['size'] > 5 * 1024 * 1024) {
        sendError(ERROR_INVALID_INPUT, 'File too large. Maximum 5MB', HTTP_BAD_REQUEST);
    }

    // Validate MIME type
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($mime, $allowedMimes)) {
        sendError(ERROR_INVALID_INPUT, 'Invalid file type. Allowed: JPEG, PNG, WebP', HTTP_BAD_REQUEST);
    }

    // Validate extension
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
    if (!in_array($ext, $allowedExts)) {
        sendError(ERROR_INVALID_INPUT, 'Invalid file extension', HTTP_BAD_REQUEST);
    }

    // Check count limit (20 max)
    $existing = glob($uploadDir . '/*.{jpg,jpeg,png,webp}', GLOB_BRACE);
    if (count($existing) >= 20) {
        sendError(ERROR_INVALID_INPUT, 'Maximum 20 background images allowed. Delete some first.', HTTP_BAD_REQUEST);
    }

    // Sanitize filename
    $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '', pathinfo($file['name'], PATHINFO_FILENAME));
    if (empty($safeName)) $safeName = 'bg';
    $safeName = substr($safeName, 0, 50);
    $finalName = $safeName . '_' . time() . '.' . $ext;
    $dest = $uploadDir . '/' . $finalName;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        sendError(ERROR_INTERNAL_ERROR, 'Failed to save file', HTTP_INTERNAL_SERVER_ERROR);
    }

    sendSuccess([
        'filename' => $finalName,
        'url' => 'uploads/bible-bg/' . $finalName,
        'size' => filesize($dest)
    ], HTTP_CREATED);
}

function handleDeleteBackground($uploadDir, $filename) {
    // Sanitize: only allow alphanumeric, dash, underscore, dot
    $safe = preg_replace('/[^a-zA-Z0-9_.\-]/', '', $filename);
    if ($safe !== $filename || strpos($filename, '..') !== false) {
        sendError(ERROR_INVALID_INPUT, 'Invalid filename', HTTP_BAD_REQUEST);
    }

    $filepath = $uploadDir . '/' . $safe;
    if (!file_exists($filepath)) {
        sendError(ERROR_ROOM_NOT_FOUND, 'Background not found', HTTP_NOT_FOUND);
    }

    // Verify it's actually an image
    $ext = strtolower(pathinfo($safe, PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
        sendError(ERROR_INVALID_INPUT, 'Not a valid image file', HTTP_BAD_REQUEST);
    }

    unlink($filepath);
    sendSuccess(['deleted' => true, 'filename' => $safe]);
}
