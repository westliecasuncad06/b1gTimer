/**
 * B1G Timer - Pusher Real-Time Integration
 * Manages WebSocket connections and event subscriptions via Pusher
 * 
 * Phase 4 Task: 4.3 (Pusher Integration)
 */

const PusherManager = {
    pusher: null,
    currentChannel: null,
    currentRoomId: null,
    isConnected: false,
    
    /**
     * Initialize Pusher (fetch config from backend)
     */
    async initialize() {
        try {
            if (typeof Pusher === 'undefined') {
                console.error('Pusher SDK not loaded.');
                return false;
            }
            
            // Fetch Pusher public config from backend
            let pusherKey, pusherCluster;
            try {
                const resp = await fetch(APIClient.baseURL + '/pusher-config');
                const json = await resp.json();
                if (json.success && json.data) {
                    pusherKey = json.data.key;
                    pusherCluster = json.data.cluster;
                }
            } catch (e) {
                console.warn('Could not fetch Pusher config from API:', e);
            }
            
            // Fallback to window globals if API failed
            pusherKey = pusherKey || window.PUSHER_KEY;
            pusherCluster = pusherCluster || window.PUSHER_CLUSTER || 'ap1';
            
            if (!pusherKey) {
                console.warn('Pusher key not configured. Real-time features disabled.');
                return false;
            }
            
            // Initialize Pusher instance
            this.pusher = new Pusher(pusherKey, {
                cluster: pusherCluster,
                forceTLS: true
            });
            
            // Handle connection events
            this.pusher.connection.bind('connected', () => {
                this.isConnected = true;
                this.updateConnectionStatus(true);
                console.log('[Pusher] Connected');
            });
            
            this.pusher.connection.bind('disconnected', () => {
                this.isConnected = false;
                this.updateConnectionStatus(false);
                console.log('[Pusher] Disconnected');
            });
            
            this.pusher.connection.bind('error', (err) => {
                console.error('[Pusher] Error:', err);
                this.updateConnectionStatus(false);
            });
            
            return true;
            
        } catch (error) {
            console.error('[Pusher] Initialization error:', error);
            return false;
        }
    },
    
    /**
     * Subscribe to room channel (presence-room-{roomId})
     */
    subscribeToRoom(roomId, onEventCallback) {
        try {
            if (!this.pusher) {
                console.warn('Pusher not initialized. Cannot subscribe to room.');
                return false;
            }
            
            // Unsubscribe from previous channel if any
            if (this.currentChannel) {
                this.pusher.unsubscribe(this.currentChannel.name);
            }
            
            this.currentRoomId = roomId;
            const channelName = `room-${roomId}`;
            
            // Subscribe to public channel (no auth required)
            this.currentChannel = this.pusher.subscribe(channelName);
            
            console.log(`[Pusher] Subscribed to ${channelName}`);
            
            // Bind to all timer events (15 action types)
            const actions = [
                'TIMER_START', 'TIMER_PAUSE', 'TIMER_RESUME', 'TIMER_STOP', 'TIMER_RESET',
                'TIMER_SKIP', 'NEXT_TIMER', 'PREVIOUS_TIMER',
                'BLACKOUT_ON', 'BLACKOUT_OFF', 'FLASH_TRIGGER',
                'MESSAGE_SHOW', 'MESSAGE_HIDE',
                'ROOM_UPDATED', 'TIME_ADJUSTMENT'
            ];
            
            actions.forEach(action => {
                this.currentChannel.bind(action, (data) => {
                    console.log(`[Pusher Event] ${action}:`, data);
                    if (onEventCallback) {
                        onEventCallback(action, data);
                    }
                });
            });
            
            return true;
            
        } catch (error) {
            console.error('[Pusher] Subscribe error:', error);
            return false;
        }
    },
    
    /**
     * Unsubscribe from current room
     */
    unsubscribeFromRoom() {
        try {
            if (this.currentChannel) {
                this.pusher.unsubscribe(this.currentChannel.name);
                this.currentChannel = null;
                this.currentRoomId = null;
                console.log('[Pusher] Unsubscribed from room');
            }
        } catch (error) {
            console.error('[Pusher] Unsubscribe error:', error);
        }
    },
    
    /**
     * Update connection status indicator on page
     */
    updateConnectionStatus(connected) {
        const indicator = document.getElementById('connection-status');
        if (!indicator) return;
        
        if (connected) {
            indicator.classList.add('connected');
        } else {
            indicator.classList.remove('connected');
        }
    },
    
    /**
     * Get connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            hasRoom: this.currentRoomId !== null,
            roomId: this.currentRoomId,
            channel: this.currentChannel?.name || null
        };
    }
};

// Make PusherManager globally available
window.PusherManager = PusherManager;
