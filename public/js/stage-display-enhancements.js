/**
 * Stage Display Phase 5 Enhancements
 * Handles connection status indicator and other Stage Display enhancements for Phase 5
 * 
 * Task 5.5: Connection Status Indicator
 * 
 * Global: window.StageDisplayEnhancements
 */

window.StageDisplayEnhancements = (() => {
    let isConnected = false;
    let lastMessageTime = 0;
    const MESSAGE_TIMEOUT = 5000; // 5 seconds

    /**
     * Initialize Stage Display enhancements
     */
    const init = async () => {
        console.log('[StageDisplayEnhancements] Initializing...');
        
        try {
            setupConnectionStatusIndicator();
            setupPeriodicStatusCheck();
            console.log('[StageDisplayEnhancements] Ready');
        } catch (error) {
            console.error('[StageDisplayEnhancements] Init error:', error);
        }
    };

    /**
     * Task 5.5: Setup connection status indicator
     */
    const setupConnectionStatusIndicator = () => {
        const statusIndicator = document.getElementById('connection-status');
        if (!statusIndicator) return;

        // Hook into Pusher connection events
        if (window.PusherManager && window.PusherManager.pusher) {
            const pusher = window.PusherManager.pusher;

            pusher.connection.bind('connected', () => {
                setConnectionStatus(true);
            });

            pusher.connection.bind('disconnected', () => {
                setConnectionStatus(false);
            });

            pusher.connection.bind('error', (err) => {
                console.error('[StageDisplayEnhancements] Pusher error:', err);
                setConnectionStatus(false);
            });

            // Initial status
            const isInitiallyConnected = pusher.connection.state === 'connected';
            setConnectionStatus(isInitiallyConnected);
        }

        // Also track message reception as a sign of connection
        if (window.StateManager) {
            StateManager.on('message-shown', () => {
                lastMessageTime = Date.now();
                setConnectionStatus(true);
            });
        }
    };

    /**
     * Set connection status and update UI
     * @param {boolean} connected - Connection status
     */
    const setConnectionStatus = (connected) => {
        isConnected = connected;
        const statusIndicator = document.getElementById('connection-status');
        
        if (!statusIndicator) return;

        if (connected) {
            statusIndicator.classList.add('connected');
            statusIndicator.classList.remove('disconnected');
            statusIndicator.title = 'Connected';
        } else {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            statusIndicator.title = 'Disconnected';
        }
    };

    /**
     * Periodic status check
     * Monitors if messages are being received
     */
    const setupPeriodicStatusCheck = () => {
        setInterval(() => {
            // If no messages received recently and Pusher says disconnected, update status
            const timeSinceLastMessage = Date.now() - lastMessageTime;
            
            if (timeSinceLastMessage > MESSAGE_TIMEOUT && isConnected) {
                // Haven't received messages in a while, assume we might be disconnected
                console.warn('[StageDisplayEnhancements] No messages received for a while');
            }
        }, 1000);
    };

    /**
     * Get current connection status
     * @returns {boolean} True if connected
     */
    const getStatus = () => isConnected;

    return {
        init,
        getStatus,
        setConnectionStatus,
    };
})();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.StateManager && window.PusherManager) {
            StageDisplayEnhancements.init();
        }
    }, 1000);
});
