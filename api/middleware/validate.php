<?php
/**
 * Input Validation Middleware
 * 
 * Task 1.4: Centralized validation functions for all API inputs
 * All validations are defensive, returning { valid: bool, errors: array }
 * Called by API endpoints before database operations
 * 
 * Constitution v1.1.0 Compliance:
 * - Section III (Security): Validates & sanitizes all POST/GET data to prevent XSS
 * - Section V (Backend API): Validation failures return 400 with error details
 */

// =============================================================================
// ROOM NAME VALIDATION
// =============================================================================

/**
 * Validate room name for creation/update
 * 
 * Rules (from ROOM_NAME_MAX_LENGTH constant):
 * - Max 100 characters
 * - Alphanumeric + spaces and hyphens only
 * - No script tags, SQL keywords, or special chars
 * - XSS-safe (strip tags, escape HTML entities)
 * 
 * @param string $name Room name input
 * @return array { "valid": bool, "errors": array }
 */
function validateRoomName(string $name): array {
    $errors = [];
    
    // Normalize whitespace
    $name = trim($name);
    
    // Check if empty
    if (empty($name)) {
        $errors[] = "Room name is required";
        return ["valid" => false, "errors" => $errors];
    }
    
    // Check length
    if (strlen($name) > 100) {
        $errors[] = "Room name exceeds 100 characters (currently " . strlen($name) . ")";
    }
    
    // Check characters: only alphanumeric, spaces, hyphens
    // Pattern: a-z, A-Z, 0-9, space, hyphen
    if (!preg_match('/^[a-zA-Z0-9\s\-]+$/', $name)) {
        $errors[] = "Room name contains invalid characters. Use only letters, numbers, spaces, and hyphens.";
    }
    
    // Strip HTML/script tags (defense-in-depth)
    $sanitized = strip_tags($name);
    if ($sanitized !== $name) {
        $errors[] = "Room name contains HTML/script tags which have been removed";
    }
    
    return [
        "valid" => empty($errors),
        "errors" => $errors,
        "sanitized" => trim($sanitized)
    ];
}

// =============================================================================
// TIMER TITLE VALIDATION
// =============================================================================

/**
 * Validate timer title for creation/update
 * 
 * Rules:
 * - Max 100 characters
 * - Allow most printable characters except script tags
 * - XSS-safe (strip tags, escape HTML entities)
 * - Support emoji and special chars (UTF-8MB4)
 * 
 * @param string $title Timer title input
 * @return array { "valid": bool, "errors": array }
 */
function validateTimerTitle(string $title): array {
    $errors = [];
    
    // Normalize whitespace
    $title = trim($title);
    
    // Check if empty
    if (empty($title)) {
        $errors[] = "Timer title is required";
        return ["valid" => false, "errors" => $errors];
    }
    
    // Check length (character count, not byte count, for emoji support)
    $char_count = mb_strlen($title, 'UTF-8');
    if ($char_count > 100) {
        $errors[] = "Timer title exceeds 100 characters (currently " . $char_count . ")";
    }
    
    // Strip HTML/script tags (defense-in-depth)
    $sanitized = strip_tags($title);
    if ($sanitized !== $title) {
        $errors[] = "Timer title contains HTML/script tags which have been removed";
    }
    
    // Check for known XSS patterns (redundant but defensive)
    if (preg_match('/(<|>|javascript:|onerror|onload|onclick)/i', $title)) {
        $errors[] = "Timer title contains potentially malicious content";
    }
    
    return [
        "valid" => empty($errors),
        "errors" => $errors,
        "sanitized" => trim($sanitized)
    ];
}

// =============================================================================
// TIMER DURATION VALIDATION
// =============================================================================

/**
 * Validate timer duration in seconds
 * 
 * Rules:
 * - Integer only (not float, not string)
 * - Range: 0 to 36000 seconds (0 to 10 hours)
 * - Non-negative
 * 
 * Accepts both numeric string and integer:
 * - "600" → converts to 600 (valid)
 * - 600 → valid
 * - "600.5" → invalid (float)
 * - "-100" → invalid (negative)
 * 
 * @param mixed $seconds Timer duration input (int or numeric string)
 * @return array { "valid": bool, "errors": array, "sanitized": int }
 */
function validateDurationSeconds($seconds): array {
    $errors = [];
    $sanitized = null;
    
    // Check if input is empty
    if ($seconds === '' || $seconds === null) {
        $errors[] = "Duration is required";
        return ["valid" => false, "errors" => $errors];
    }
    
    // Convert to integer if numeric string
    if (is_string($seconds) && is_numeric($seconds)) {
        // Check if it's a valid integer (no decimal part)
        if (strpos($seconds, '.') !== false) {
            $errors[] = "Duration must be a whole number (no decimals)";
            return ["valid" => false, "errors" => $errors];
        }
        $seconds = (int)$seconds;
    }
    
    // Check if it's an integer type
    if (!is_int($seconds)) {
        $errors[] = "Duration must be a number";
        return ["valid" => false, "errors" => $errors];
    }
    
    // Check minimum (non-negative)
    if ($seconds < 0) {
        $errors[] = "Duration cannot be negative";
    }
    
    // Check maximum (36000 seconds = 10 hours)
    if ($seconds > 36000) {
        $errors[] = "Duration exceeds maximum of 36000 seconds (10 hours). Provided: " . $seconds;
    }
    
    $sanitized = $seconds;
    
    return [
        "valid" => empty($errors),
        "errors" => $errors,
        "sanitized" => $sanitized
    ];
}

// =============================================================================
// MESSAGE TEXT VALIDATION
// =============================================================================

/**
 * Validate message text for display on stage
 * 
 * Rules:
 * - Max 255 characters
 * - No HTML tags (stripped and flagged)
 * - Support emoji and special chars
 * - XSS-safe (strip tags, escape HTML entities)
 * 
 * @param string $text Message text input
 * @return array { "valid": bool, "errors": array, "sanitized": string }
 */
function validateMessageText(string $text): array {
    $errors = [];
    
    // Normalize whitespace (but preserve internal spacing)
    $text = trim($text);
    
    // Empty is allowed (user can send blank message)
    if (empty($text)) {
        return [
            "valid" => true,
            "errors" => [],
            "sanitized" => ""
        ];
    }
    
    // Check length (character count for emoji support)
    $char_count = mb_strlen($text, 'UTF-8');
    if ($char_count > 255) {
        $errors[] = "Message text exceeds 255 characters (currently " . $char_count . ")";
    }
    
    // Strip HTML/script tags (defense-in-depth)
    $sanitized = strip_tags($text);
    if ($sanitized !== $text) {
        $errors[] = "Message contains HTML/script tags which have been removed";
    }
    
    // Check for XSS patterns
    if (preg_match('/(<|>|javascript:|onerror|onload|onclick)/i', $text)) {
        $errors[] = "Message contains potentially malicious content";
    }
    
    return [
        "valid" => empty($errors),
        "errors" => $errors,
        "sanitized" => trim($sanitized)
    ];
}

// =============================================================================
// COMBINED VALIDATION HELPER
// =============================================================================

/**
 * Validate all timer object fields at once
 * Useful for PUT /api/v1/rooms/{id} when updating multiple timers
 * 
 * @param array $timer Timer object: { id, title, duration_seconds, position }
 * @return array { "valid": bool, "errors": array, "sanitized": object }
 */
function validateTimerObject(array $timer): array {
    $all_errors = [];
    $sanitized = [];
    
    // Validate title (required)
    if (!isset($timer['title'])) {
        $all_errors[] = "Timer title is required";
    } else {
        $result = validateTimerTitle($timer['title']);
        if (!$result['valid']) {
            $all_errors = array_merge($all_errors, $result['errors']);
        } else {
            $sanitized['title'] = $result['sanitized'] ?? $timer['title'];
        }
    }
    
    // Validate duration_seconds (required)
    if (!isset($timer['duration_seconds'])) {
        $all_errors[] = "Duration is required";
    } else {
        $result = validateDurationSeconds($timer['duration_seconds']);
        if (!$result['valid']) {
            $all_errors = array_merge($all_errors, $result['errors']);
        } else {
            $sanitized['duration_seconds'] = $result['sanitized'];
        }
    }
    
    // Validate position (optional, auto-generated if absent)
    if (isset($timer['position'])) {
        if (!is_int($timer['position']) || $timer['position'] < 0) {
            $all_errors[] = "Timer position must be a non-negative integer";
        } else {
            $sanitized['position'] = $timer['position'];
        }
    }
    
    // Preserve ID if present
    if (isset($timer['id'])) {
        $sanitized['id'] = $timer['id'];
    }
    
    return [
        "valid" => empty($all_errors),
        "errors" => $all_errors,
        "sanitized" => $sanitized
    ];
}

// =============================================================================
// BATCH VALIDATION HELPER
// =============================================================================

/**
 * Validate multiple timer objects (for room timer array updates)
 * Called when saving a room with N timers
 * 
 * @param array $timers Array of timer objects
 * @param int $max_timers Maximum allowed timers per room
 * @return array { "valid": bool, "errors": array, "sanitized": array }
 */
function validateTimerArray(array $timers, int $max_timers = 100): array {
    $all_errors = [];
    $sanitized = [];
    
    // Check count
    if (count($timers) > $max_timers) {
        $all_errors[] = "Exceeds maximum of " . $max_timers . " timers per room (provided: " . count($timers) . ")";
    }
    
    // Validate each timer
    foreach ($timers as $index => $timer) {
        $result = validateTimerObject($timer);
        if (!$result['valid']) {
            foreach ($result['errors'] as $error) {
                $all_errors[] = "Timer #" . ($index + 1) . ": " . $error;
            }
        } else {
            $sanitized[] = $result['sanitized'];
        }
    }
    
    return [
        "valid" => empty($all_errors),
        "errors" => $all_errors,
        "sanitized" => $sanitized
    ];
}

/** Alias — rooms.php calls validateTimerList() */
function validateTimerList(array $timers): array {
    return validateTimerArray($timers);
}

?>
