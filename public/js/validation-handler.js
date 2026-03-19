/**
 * Validation Handler - Task 5.7: Input Validation & Feedback
 * Client-side validation for room names, timer titles, durations, and messages
 * 
 * Global: window.ValidationHandler
 */

window.ValidationHandler = (() => {
    const ROOM_NAME_MAX = 100;
    const TIMER_TITLE_MAX = 100;
    const MESSAGE_TEXT_MAX = 255;
    const TIMER_DURATION_MIN = 0;
    const TIMER_DURATION_MAX = 36000; // 10 hours in seconds

    /**
     * Validate room name
     * @param {string} name - Room name to validate
     * @returns {Object} { valid: bool, errors: [string], message: string }
     */
    const validateRoomName = (name) => {
        const errors = [];

        if (!name || name.trim().length === 0) {
            errors.push('Room name is required');
        }

        if (name.length > ROOM_NAME_MAX) {
            errors.push(`Room name must be ${ROOM_NAME_MAX} characters or fewer (currently ${name.length})`);
        }

        // Check for XSS attempts
        if (name !== sanitizeInput(name)) {
            errors.push('Room name contains invalid characters');
        }

        return {
            valid: errors.length === 0,
            errors,
            message: errors.length > 0 ? errors[0] : 'Valid',
        };
    };

    /**
     * Validate timer title
     * @param {string} title - Timer title to validate
     * @returns {Object} { valid: bool, errors: [string], message: string }
     */
    const validateTimerTitle = (title) => {
        const errors = [];

        if (!title || title.trim().length === 0) {
            errors.push('Timer title is required');
        }

        if (title.length > TIMER_TITLE_MAX) {
            errors.push(`Timer title must be ${TIMER_TITLE_MAX} characters or fewer (currently ${title.length})`);
        }

        // Check for XSS attempts
        if (title !== sanitizeInput(title)) {
            errors.push('Timer title contains invalid characters');
        }

        return {
            valid: errors.length === 0,
            errors,
            message: errors.length > 0 ? errors[0] : 'Valid',
        };
    };

    /**
     * Validate duration string in MM:SS format
     * @param {string} durationStr - Duration string like "05:30"
     * @returns {Object} { valid: bool, errors: [string], seconds: number, message: string }
     */
    const validateDurationString = (durationStr) => {
        const errors = [];
        let seconds = 0;

        if (!durationStr || durationStr.trim().length === 0) {
            errors.push('Duration is required');
        } else {
            // Parse MM:SS format
            const parts = durationStr.split(':');
            if (parts.length !== 2) {
                errors.push('Duration must be in MM:SS format (e.g., 05:30)');
            } else {
                const minutes = parseInt(parts[0], 10);
                const secs = parseInt(parts[1], 10);

                if (isNaN(minutes) || isNaN(secs)) {
                    errors.push('Duration values must be numbers');
                } else if (minutes < 0 || secs < 0) {
                    errors.push('Duration values must be positive');
                } else if (secs > 59) {
                    errors.push('Seconds must be 0-59');
                } else {
                    seconds = minutes * 60 + secs;
                    if (seconds > TIMER_DURATION_MAX) {
                        errors.push(`Duration must be less than ${Math.floor(TIMER_DURATION_MAX / 60)} minutes`);
                    }
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            seconds,
            message: errors.length > 0 ? errors[0] : 'Valid',
        };
    };

    /**
     * Validate duration in seconds
     * @param {number} seconds - Duration in seconds
     * @returns {Object} { valid: bool, errors: [string], message: string }
     */
    const validateDurationSeconds = (seconds) => {
        const errors = [];

        if (seconds === null || seconds === undefined) {
            errors.push('Duration is required');
        } else if (typeof seconds !== 'number') {
            errors.push('Duration must be a number');
        } else if (seconds < TIMER_DURATION_MIN) {
            errors.push('Duration must be positive');
        } else if (seconds > TIMER_DURATION_MAX) {
            errors.push(`Duration must be less than ${Math.floor(TIMER_DURATION_MAX / 60)} minutes`);
        }

        return {
            valid: errors.length === 0,
            errors,
            message: errors.length > 0 ? errors[0] : 'Valid',
        };
    };

    /**
     * Validate message text
     * @param {string} text - Message text to validate
     * @returns {Object} { valid: bool, errors: [string], message: string }
     */
    const validateMessageText = (text) => {
        const errors = [];

        if (text && text.length > MESSAGE_TEXT_MAX) {
            errors.push(`Message must be ${MESSAGE_TEXT_MAX} characters or fewer (currently ${text.length})`);
        }

        // Check for HTML tags (block them)
        if (text && /<[^>]*>/.test(text)) {
            errors.push('HTML tags are not allowed in messages');
        }

        return {
            valid: errors.length === 0,
            errors,
            message: errors.length > 0 ? errors[0] : 'Valid',
        };
    };

    /**
     * Sanitize input to prevent XSS
     * @param {string} input - Input string to sanitize
     * @returns {string} Sanitized string
     */
    const sanitizeInput = (input) => {
        if (typeof input !== 'string') return input;
        
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    };

    /**
     * Display inline error message
     * @param {HTMLElement} inputElement - The input element
     * @param {string} errorMessage - Error message to display
     */
    const showError = (inputElement, errorMessage) => {
        // Remove existing error if any
        const existingError = inputElement.parentElement.querySelector('.input-error');
        if (existingError) {
            existingError.remove();
        }

        if (errorMessage) {
            // Add error styling to input
            inputElement.style.borderColor = '#ef4444';
            inputElement.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';

            // Create error message element
            const errorDiv = document.createElement('div');
            errorDiv.className = 'input-error';
            errorDiv.style.cssText = 'color: #dc2626; font-size: 0.75rem; margin-top: 0.25rem;';
            errorDiv.textContent = errorMessage;
            inputElement.parentElement.appendChild(errorDiv);
        } else {
            // Clear error styling
            inputElement.style.borderColor = '#d1d5db';
            inputElement.style.boxShadow = '';
        }
    };

    /**
     * Clear error display
     * @param {HTMLElement} inputElement - The input element
     */
    const clearError = (inputElement) => {
        showError(inputElement, '');
    };

    /**
     * Validate all timers in a list
     * @param {Array} timers - Array of timer objects { title, duration_seconds, ... }
     * @returns {Object} { valid: bool, errors: Object }
     */
    const validateTimerList = (timers) => {
        const errors = {};
        let allValid = true;

        if (!timers || !Array.isArray(timers) || timers.length === 0) {
            return {
                valid: false,
                errors: { general: 'At least one timer is required' },
            };
        }

        timers.forEach((timer, index) => {
            const timerErrors = [];

            // Validate title
            const titleValidation = validateTimerTitle(timer.title || '');
            if (!titleValidation.valid) {
                timerErrors.push(...titleValidation.errors);
            }

            // Validate duration
            const durationValidation = validateDurationSeconds(timer.duration_seconds);
            if (!durationValidation.valid) {
                timerErrors.push(...durationValidation.errors);
            }

            if (timerErrors.length > 0) {
                errors[`timer_${index}`] = timerErrors;
                allValid = false;
            }
        });

        return {
            valid: allValid,
            errors,
        };
    };

    /**
     * Format duration to MM:SS string
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted string like "05:30"
     */
    const formatDurationToString = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    /**
     * Setup live validation on an input element
     * @param {HTMLElement} inputElement - The input element
     * @param {Function} validationFn - Validation function to call
     * @param {number} debounceMs - Debounce delay in milliseconds
     */
    const setupLiveValidation = (inputElement, validationFn, debounceMs = 300) => {
        let timeoutId = null;

        inputElement.addEventListener('input', () => {
            if (timeoutId) clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                const result = validationFn(inputElement.value);
                if (result.valid) {
                    clearError(inputElement);
                } else {
                    showError(inputElement, result.message);
                }
            }, debounceMs);
        });

        // Validate on blur
        inputElement.addEventListener('blur', () => {
            const result = validationFn(inputElement.value);
            if (!result.valid) {
                showError(inputElement, result.message);
            }
        });
    };

    return {
        validateRoomName,
        validateTimerTitle,
        validateDurationString,
        validateDurationSeconds,
        validateMessageText,
        validateTimerList,
        sanitizeInput,
        showError,
        clearError,
        setupLiveValidation,
        formatDurationToString,
        ROOM_NAME_MAX,
        TIMER_TITLE_MAX,
        MESSAGE_TEXT_MAX,
    };
})();
