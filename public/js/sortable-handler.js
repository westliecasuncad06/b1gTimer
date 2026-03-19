/**
 * Sortable Handler - Task 5.1: Drag-to-Reorder with SortableJS
 * Manages drag-and-drop reordering of timers with WCAG 2.1 Level AA keyboard support
 * 
 * Global: window.SortableHandler
 */

window.SortableHandler = (() => {
    let sortableInstance = null;
    let onReorderCallback = null;

    /**
     * Initialize SortableJS on timer list
     * @param {HTMLElement} timerListElement - The container element with timer items
     * @param {Function} onReorder - Callback(oldIndex, newIndex) when reorder completes
     */
    const initialize = (timerListElement, onReorder) => {
        if (!timerListElement) {
            console.error('Timer list element not found');
            return;
        }

        onReorderCallback = onReorder;

        // Destroy existing instance if any
        if (sortableInstance) {
            sortableInstance.destroy();
        }

        // Initialize SortableJS
        sortableInstance = Sortable.create(timerListElement, {
            animation: 150,
            handle: '.drag-handle', // Only drag by handle
            ghostClass: 'opacity-50',
            chosenClass: 'border-blue-500',
            dragClass: 'dragging',
            forceFallback: false,
            delay: 200,
            delayOnTouchOnly: true,
            onEnd: handleDragEnd,
            onMove: () => true, // Allow all moves
        });

        // Add keyboard support to each timer item
        setupKeyboardSupport(timerListElement);
    };

    /**
     * Handle drag-and-drop completion
     * @param {Event} evt - Sortable event with oldIndex and newIndex
     */
    const handleDragEnd = (evt) => {
        const { oldIndex, newIndex } = evt;
        
        if (oldIndex === newIndex) {
            return; // No actual change
        }

        // Update UI immediately
        updateTimerPositions(evt.from);

        // Call callback
        if (onReorderCallback) {
            onReorderCallback(oldIndex, newIndex);
        }
    };

    /**
     * Update timer positions after reorder
     * @param {HTMLElement} listElement - The timer list container
     */
    const updateTimerPositions = (listElement) => {
        const items = listElement.querySelectorAll('.timer-list-item');
        items.forEach((item, index) => {
            item.dataset.position = index;
        });
    };

    /**
     * Setup keyboard accessibility for timer reordering
     * @param {HTMLElement} timerListElement - The container element
     */
    const setupKeyboardSupport = (timerListElement) => {
        const items = timerListElement.querySelectorAll('.timer-list-item');
        
        items.forEach((item, index) => {
            // Make item focusable
            item.setAttribute('role', 'listitem');
            item.setAttribute('tabindex', '0');
            
            // Add keyboard event listeners
            item.addEventListener('keydown', (e) => handleKeyboardNavigation(e, timerListElement, index));
        });
    };

    /**
     * Handle keyboard navigation for reordering
     * @param {KeyboardEvent} event - The keyboard event
     * @param {HTMLElement} listElement - The timer list container
     * @param {number} currentIndex - Index of currently focused item
     */
    const handleKeyboardNavigation = (event, listElement, currentIndex) => {
        const items = Array.from(listElement.querySelectorAll('.timer-list-item'));
        let moveToIndex = null;

        if (event.key === 'ArrowUp' || (event.key === 'ArrowLeft')) {
            event.preventDefault();
            moveToIndex = Math.max(0, currentIndex - 1);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault();
            moveToIndex = Math.min(items.length - 1, currentIndex + 1);
        }

        if (moveToIndex !== null && moveToIndex !== currentIndex) {
            // Perform reorder
            const item = items[currentIndex];
            const targetItem = items[moveToIndex];
            
            if (moveToIndex > currentIndex) {
                // Moving down
                item.parentNode.insertBefore(item, targetItem.nextSibling);
            } else {
                // Moving up
                item.parentNode.insertBefore(item, targetItem);
            }

            // Update positions
            updateTimerPositions(listElement);

            // Focus the moved item
            setTimeout(() => {
                item.focus();
            }, 0);

            // Call callback
            if (onReorderCallback) {
                onReorderCallback(currentIndex, moveToIndex);
            }
        }

        // Arrow up/down buttons for explicit reordering (if elements exist with data-action)
        if (event.key === 'Enter' && event.target.dataset.action === 'move-up') {
            event.preventDefault();
            if (currentIndex > 0) {
                handleKeyboardNavigation({ key: 'ArrowUp', preventDefault: () => {} }, listElement, currentIndex);
            }
        } else if (event.key === 'Enter' && event.target.dataset.action === 'move-down') {
            event.preventDefault();
            if (currentIndex < items.length - 1) {
                handleKeyboardNavigation({ key: 'ArrowDown', preventDefault: () => {} }, listElement, currentIndex);
            }
        }
    };

    /**
     * Add move-up button to timer item
     * @param {HTMLElement} timerItem - The timer item element
     * @param {Function} callback - Callback when button clicked
     */
    const addMoveUpButton = (timerItem, callback) => {
        let button = timerItem.querySelector('[data-action="move-up"]');
        if (!button) {
            button = document.createElement('button');
            button.dataset.action = 'move-up';
            button.className = 'btn btn-secondary';
            button.title = 'Move timer up (keyboard: Up Arrow)';
            button.innerHTML = '<i class="fas fa-arrow-up"></i>';
            button.style.padding = '0.5rem 0.75rem';
            button.setAttribute('aria-label', 'Move timer up in queue');
            button.setAttribute('tabindex', '0');
            button.addEventListener('click', callback);
            timerItem.insertBefore(button, timerItem.firstChild);
        }
    };

    /**
     * Add move-down button to timer item
     * @param {HTMLElement} timerItem - The timer item element
     * @param {Function} callback - Callback when button clicked
     */
    const addMoveDownButton = (timerItem, callback) => {
        let button = timerItem.querySelector('[data-action="move-down"]');
        if (!button) {
            button = document.createElement('button');
            button.dataset.action = 'move-down';
            button.className = 'btn btn-secondary';
            button.title = 'Move timer down (keyboard: Down Arrow)';
            button.innerHTML = '<i class="fas fa-arrow-down"></i>';
            button.style.padding = '0.5rem 0.75rem';
            button.setAttribute('aria-label', 'Move timer down in queue');
            button.setAttribute('tabindex', '0');
            button.addEventListener('click', callback);
            timerItem.appendChild(button);
        }
    };

    /**
     * Add drag handle to timer item
     * @param {HTMLElement} timerItem - The timer item element
     */
    const addDragHandle = (timerItem) => {
        if (!timerItem.querySelector('.drag-handle')) {
            const handle = document.createElement('div');
            handle.className = 'drag-handle';
            handle.style.cssText = 'cursor: grab; color: #9ca3af; user-select: none; margin-right: 0.5rem; flex-shrink: 0;';
            handle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
            handle.setAttribute('aria-label', 'Drag to reorder (keyboard: Use arrow keys)');
            handle.setAttribute('title', 'Drag to reorder or use arrow keys');
            timerItem.insertBefore(handle, timerItem.firstChild);
        }
    };

    /**
     * Get current timer order
     * @param {HTMLElement} listElement - The timer list container
     * @returns {Array} Array of timer IDs in current order
     */
    const getTimerOrder = (listElement) => {
        const items = listElement.querySelectorAll('.timer-list-item');
        return Array.from(items).map(item => item.dataset.timerId);
    };

    /**
     * Destroy sortable instance
     */
    const destroy = () => {
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }
    };

    return {
        initialize,
        addDragHandle,
        addMoveUpButton,
        addMoveDownButton,
        getTimerOrder,
        destroy,
    };
})();
