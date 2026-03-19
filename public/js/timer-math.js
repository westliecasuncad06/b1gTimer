/**
 * B1G Timer - Timer Math & Calculations
 * Handles countdown logic, time conversions, and venue time calculations
 * 
 * Phase 4 Tasks: 4.2 (Timer Countdown), 4.7 (Time Calculations)
 */

const TimerMath = {
    // Server timezone (UTC) - used for accurate calculations
    SERVER_TIMEZONE: 'UTC',
    
    // Venue timezone (Asia/Manila by default, configurable via .env)
    VENUE_TIMEZONE: 'Asia/Manila',
    
    /**
     * Format seconds to display format (smart: adapts to duration)
     * 0:26 for <1min, 2:26 for <1hr, 1:02:26 for >=1hr
     */
    formatTime(totalSeconds) {
        const sec = Math.max(0, Math.ceil(totalSeconds));
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${m}:${String(s).padStart(2, '0')}`;
    },

    /**
     * Format seconds to full HH:MM:SS (always 3 parts)
     */
    formatTimeFull(totalSeconds) {
        const sec = Math.max(0, Math.ceil(totalSeconds));
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },

    /**
     * Parse HH:MM:SS or MM:SS format back to seconds
     */
    parseTime(timeStr) {
        const parts = timeStr.split(':');
        if (parts.length === 3) {
            return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
        }
        if (parts.length === 2) {
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }
        return 0;
    },
    
    /**
     * Get current time in venue timezone
     */
    getNowInVenue() {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: this.VENUE_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        
        const parts = formatter.formatToParts(new Date());
        const time = {};
        parts.forEach(part => {
            if (part.type !== 'literal') {
                time[part.type] = part.value;
            }
        });
        
        return new Date(
            time.year,
            parseInt(time.month, 10) - 1,
            time.day,
            time.hour === '12' && time.dayPeriod === 'AM' ? 0 : 
            (parseInt(time.hour, 10) + (time.dayPeriod === 'PM' && time.hour !== '12' ? 12 : 0)),
            time.minute,
            time.second
        );
    },
    
    /**
     * Format time for display (HH:MM AM/PM)
     */
    formatVenueTime(date = null) {
        if (!date) {
            date = this.getNowInVenue();
        }
        
        const hours = date.getHours() % 12 || 12;
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
        
        return `${hours}:${minutes} ${ampm}`;
    },
    
    /**
     * Calculate projected finish time of current timer
     */
    calculateFinishTime(startTime, remainingSeconds) {
        // startTime: ISO8601 timestamp when timer started (in UTC)
        // remainingSeconds: seconds left on timer
        
        const startDate = new Date(startTime);
        const finishDate = new Date(startDate.getTime() + (remainingSeconds * 1000));
        
        return this.formatVenueTime(finishDate);
    },
    
    /**
     * Calculate if timer is over/under scheduled finish time
     * Returns positive if over (red), negative if under (green)
     */
    calculateOverUnder(scheduledFinishTime, actualRemainingSeconds) {
        // scheduledFinishTime: ISO8601 of when timer was supposed to finish
        // actualRemainingSeconds: time actually remaining
        
        const scheduled = new Date(scheduledFinishTime);
        const now = new Date();
        const timeUntilScheduled = (scheduled - now) / 1000;
        
        const diff = actualRemainingSeconds - timeUntilScheduled;
        return diff; // positive = over, negative = under
    },
    
    /**
     * Format over/under display: "+02:30" or "-01:15"
     */
    formatOverUnder(secondsDiff) {
        const sign = secondsDiff >= 0 ? '+' : '-';
        const absDiff = Math.abs(secondsDiff);
        const minutes = Math.floor(absDiff / 60);
        const seconds = absDiff % 60;
        
        return `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    },
    
    /**
     * Calculate progress percentage (0-100)
     */
    calculateProgress(remaining, duration) {
        if (duration === 0) return 100;
        const percent = (remaining / duration) * 100;
        return Math.max(0, Math.min(100, Math.round(percent)));
    },
    
    /**
     * Determine progress bar color based on time remaining
     * Green: > 50%, Yellow: 25-50%, Red: < 25%
     */
    getProgressColor(progress) {
        if (progress > 50) return '#4ade80'; // Green
        if (progress > 25) return '#facc15'; // Yellow
        return '#ef4444'; // Red
    },
    
    /**
     * Convert duration to human-readable (smart format)
     */
    formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${m}:${String(s).padStart(2, '0')}`;
    }
};

// Make TimerMath globally available
window.TimerMath = TimerMath;
