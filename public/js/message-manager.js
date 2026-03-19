/**
 * B1G Timer - Message Manager
 * Handles message display, styling, animations, and queueing
 * 
 * Phase 4 Task: 4.6 (Message System)
 */

const MessageManager = {
    /**
     * Show message on Stage Display
     */
    async showMessage(text, color = 'white', bold = false, fontSize = 'normal', fontStyle = 'sans-serif', scrollEnabled = false, scrollDirection = 'left', scrollSpeed = 10, msgBgType = 'default', msgBgColor = '#000000') {
        try {
            // Update state
            StateManager.showMessage(text, color, bold, fontSize);
            
            // Broadcast to Stage Display
            await APIClient.broadcastEvent(
                StateManager.state.selectedRoomId,
                'MESSAGE_SHOW',
                {
                    text,
                    color,
                    bold,
                    fontSize,
                    fontStyle,
                    scrollEnabled,
                    scrollDirection,
                    scrollSpeed,
                    msgBgType,
                    msgBgColor,
                    displayId: localStorage.getItem('displayId') || 'unknown'
                }
            );
            
            console.log('[MessageManager] Message shown:', text);
        } catch (error) {
            console.error('[MessageManager] Error showing message:', error);
        }
    },
    
    /**
     * Hide message on Stage Display
     */
    async hideMessage() {
        try {
            StateManager.hideMessage();
            
            await APIClient.broadcastEvent(
                StateManager.state.selectedRoomId,
                'MESSAGE_HIDE',
                {
                    displayId: localStorage.getItem('displayId') || 'unknown'
                }
            );
            
            console.log('[MessageManager] Message hidden');
        } catch (error) {
            console.error('[MessageManager] Error hiding message:', error);
        }
    },
    
    /**
     * Flash message on Stage Display
     */
    async flashMessage(text, color = 'white', bold = false, fontSize = 'normal', fontStyle = 'sans-serif', scrollEnabled = false, scrollDirection = 'left', scrollSpeed = 10, msgBgType = 'default', msgBgColor = '#000000') {
        try {
            await this.showMessage(text, color, bold, fontSize, fontStyle, scrollEnabled, scrollDirection, scrollSpeed, msgBgType, msgBgColor);
            
            // Add flash animation
            const ribbon = document.getElementById('message-ribbon');
            if (ribbon) {
                ribbon.classList.add('flash');
                setTimeout(() => ribbon.classList.remove('flash'), 500);
            }
            
            console.log('[MessageManager] Message flashed');
        } catch (error) {
            console.error('[MessageManager] Error flashing message:', error);
        }
    },
    
    /**
     * Update message style in Control Dashboard
     */
    updateMessageStyle(color, bold, fontSize) {
        StateManager.setMessageStyle(color, bold, fontSize);
        
        // Update UI
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.classList.remove('selected');
            if (swatch.dataset.color === color) {
                swatch.classList.add('selected');
            }
        });
        
        const boldCheckbox = document.getElementById('message-bold');
        if (boldCheckbox) {
            boldCheckbox.checked = bold;
        }
        
        const fontSizeSelect = document.getElementById('message-font-size');
        if (fontSizeSelect) {
            fontSizeSelect.value = fontSize;
        }
    },
    
    /**
     * Render message queue in Control Dashboard
     */
    renderMessageQueue() {
        const queueList = document.getElementById('queued-messages-list');
        if (!queueList) return;
        
        const queue = StateManager.state.messageQueue;
        
        if (queue.length === 0) {
            queueList.innerHTML = '<div style="color: #9ca3af; font-size: 0.875rem;">No messages sent yet</div>';
            return;
        }
        
        // Show last 5 messages
        const recent = queue.slice(-5).reverse();
        queueList.innerHTML = recent.map(msg => `
            <div class="message-list-item">
                <div style="font-weight: 600; word-break: break-word; margin-bottom: 0.25rem;">
                    ${this.escapeHtml(msg.text)}
                </div>
                <div style="font-size: 0.75rem; color: #6b7280;">
                    ${msg.color} · ${msg.fontSize}px ${msg.bold ? '(bold)' : ''}
                </div>
            </div>
        `).join('');
    },
    
    /**
     * Handle remote message event from Pusher
     */
    handleRemoteMessageEvent(action, data) {
        console.log('[MessageManager] Remote event:', action);
        
        if (action === 'MESSAGE_SHOW') {
            this.displayMessageOnStage(data);
        } else if (action === 'MESSAGE_HIDE') {
            this.hideMessageOnStage();
        }
    },
    
    /**
     * Display message on Stage Display
     */
    displayMessageOnStage(messageData) {
        const ribbon = document.getElementById('message-ribbon');
        const messageText = document.getElementById('message-text');
        
        if (!ribbon || !messageText) return;
        
        // Set text content
        messageText.textContent = messageData.text;
        
        // Apply styling
        ribbon.className = 'message-ribbon visible';
        
        if (messageData.bold) {
            ribbon.classList.add('bold');
        }
        
        // Font size mapping
        const fontSizeMap = {
            small: '2vw',
            normal: '3vw',
            large: '4.5vw',
            xlarge: '6vw'
        };
        const fontSize = fontSizeMap[messageData.fontSize] || fontSizeMap.normal;
        messageText.style.fontSize = fontSize;
        
        // Font style mapping
        const fontFamilyMap = {
            'sans-serif': "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
            'serif': "'Georgia','Times New Roman',serif",
            'monospace': "'Courier New','Monaco',monospace",
            'cursive': "'Brush Script MT','Segoe Script',cursive"
        };
        messageText.style.fontFamily = fontFamilyMap[messageData.fontStyle] || fontFamilyMap['sans-serif'];
        
        messageText.style.color = this.getColorHex(messageData.color);
        
        // Apply color class for predefined colors
        ribbon.classList.add(`color-${messageData.color}`);
        
        // Scrolling
        if (messageData.scrollEnabled) {
            ribbon.classList.add('scrolling');
            if (messageData.scrollDirection === 'right') {
                ribbon.classList.add('scroll-right');
            }
            const speed = Math.max(2, Math.min(60, messageData.scrollSpeed || 10));
            ribbon.style.setProperty('--scroll-duration', speed + 's');
        }
        
        // Message background
        const bgType = messageData.msgBgType || 'default';
        if (bgType === 'transparent') {
            ribbon.classList.add('msg-bg-transparent');
            ribbon.style.backgroundColor = '';
        } else if (bgType === 'custom' && messageData.msgBgColor) {
            ribbon.style.backgroundColor = messageData.msgBgColor;
        }
        // 'default' uses the CSS default (rgba(0,0,0,.85))
        
        console.log('[MessageManager] Message displayed on stage');
    },
    
    /**
     * Hide message on Stage Display
     */
    hideMessageOnStage() {
        const ribbon = document.getElementById('message-ribbon');
        if (ribbon) {
            ribbon.classList.remove('visible');
            ribbon.classList.remove('bold');
            ribbon.classList.remove('flash');
            ribbon.classList.remove('scrolling');
            ribbon.classList.remove('scroll-right');
            ribbon.classList.remove('msg-bg-transparent');
            ribbon.style.removeProperty('--scroll-duration');
            ribbon.style.backgroundColor = '';
            const messageText = document.getElementById('message-text');
            if (messageText) {
                messageText.style.fontSize = '';
                messageText.style.fontFamily = '';
            }
            console.log('[MessageManager] Message hidden on stage');
        }
    },
    
    /**
     * Convert color name to hex value
     */
    getColorHex(colorName) {
        const colors = {
            white: '#ffffff',
            yellow: '#ffff00',
            red: '#ff0000',
            green: '#00ff00',
            blue: '#0000ff',
            magenta: '#ff00ff',
            cyan: '#00ffff',
            black: '#000000'
        };
        return colors[colorName] || '#ffffff';
    },
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Make MessageManager globally available
window.MessageManager = MessageManager;
