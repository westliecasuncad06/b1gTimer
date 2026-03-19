# B1G Timer - Operator Manual

**Version**: 1.0  
**For**: Event Operators Using Control Dashboard  
**Updated**: March 19, 2026  

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Managing Events](#managing-events)
3. [Controlling Timers](#controlling-timers)
4. [Display Messages](#display-messages)
5. [Special Effects](#special-effects)
6. [Tips & Tricks](#tips--tricks)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### First Time Setup (5 minutes)

1. **Open Control Dashboard**
   - Navigate to: `https://yourdomain.com/index.html`
   - Should see blue interface with timer controls

2. **Create Your Event**
   - Click "Room Selector" (top of screen)
   - Click "+ New Room" button
   - Type event name (e.g., "Morning Session")
   - Click "Create"

3. **Add Timers**
   - Click "+ Add Timer" button
   - Enter segment name (e.g., "Welcome")
   - Enter duration (MM:SS format, e.g., 15:30 = 15 minutes 30 seconds)
   - Click "Add"
   - Repeat for each segment

4. **Save Your Setup**
   - Click "Save Changes" button
   - Wait for green confirmation

5. **Open Stage Display**
   - On projector/TV computer, open: `https://yourdomain.com/stage.html`
   - Press F11 for full screen
   - Should see countdown display (00:00 initially)

6. **Start Event**
   - Back on Control Dashboard
   - Click "Play" button
   - Stage Display should show countdown starting
   - All displays connected automatically sync

---

## Managing Events

### Creating a New Event

**What is an Event Room?**
- Container for all timers for your event
- Can save and reuse for future events
- Auto-saves your progress

**Steps**:
1. Click **"Room Selector"** dropdown at top
2. Click **"+ New Room"** button
3. Enter room name:
   - Examples: "Annual Conference 2026", "Board Meeting", "Workshop Session"
   - Max 100 characters
4. Click **"Create"** button
5. Room is created and automatically selected

**Tip**: Use descriptive names with date
- Good: "Tech Summit March 2026"
- Bad: "Event1", "Meeting"

### Adding Timers to Event

**What is a Timer?**
- Individual time segment within your event
- Examples: "Opening remarks", "Presentation 1", "Break", "Closing"

**Add Timer**:
1. Click **"+ Add Timer"** button
2. Enter **Timer Title**:
   - Examples: "Welcome", "Panel Discussion", "Q&A", "Networking"
   - Max 100 characters
3. Enter **Duration** in MM:SS format:
   - Format: Minutes:Seconds
   - Examples:
     - 00:30 = 30 seconds
     - 05:00 = 5 minutes
     - 45:30 = 45 minutes 30 seconds
     - 2:15:00 = 2 hours 15 minutes (if supported)
4. Click **"Add"** button
5. Timer appears in your timer list

**Common Durations**:
- 05:00 = 5-minute segment
- 10:00 = 10-minute segment
- 15:00 = 15-minute segment
- 20:00 = 20-minute segment
- 30:00 = 30-minute segment
- 60:00 = 1-hour segment

### Reordering Timers

**Why Reorder?**
- Got timers in wrong order
- Want to change event flow
- Insert new segment mid-event

**Method 1: Drag and Drop**
1. Hover over timer - you'll see drag handle (::)
2. Click and hold timer
3. Drag to new position
4. Release to drop
5. Timer reorders instantly

**Method 2: Arrow Buttons**
1. Each timer has **↑** (up) and **↓** (down) buttons
2. Click **↑** to move timer up one spot
3. Click **↓** to move timer down one spot
4. Repeat until in correct order

**Method 3: Keyboard (if focused)**
1. Click on timer to focus it
2. Press **↑** arrow key to move up
3. Press **↓** arrow key to move down
4. Press **Enter** to confirm

### Editing Timer

**Change Timer Details**:
1. Click **"Edit"** button on timer (pencil icon)
2. Modify title or duration
3. Click **"Save"** or press Enter
4. Changes saved immediately

### Deleting Timer

**Remove Timer from Event**:
1. Click **"Delete"** button on timer (trash icon)
2. Confirm deletion
3. Timer removed from event

### Saving Your Event

**Auto-Save**:
- Changes auto-save every 30 seconds
- You'll see "Saved" message

**Manual Save**:
1. After making changes, click **"Save Changes"** button
2. Wait for green confirmation: "Saved successfully"
3. Unsaved indicator (orange dot) disappears

**Why Save?**
- Persist information to database
- Backup if browser crashes
- Load event again later

### Switching Between Events

**Load Different Event**:
1. Click **"Room Selector"** dropdown
2. Select room from list
3. If unsaved changes:
   - Click **"Save & Switch"** to save first
   - Or **"Discard"** to switch without saving
   - Or **"Cancel"** to stay on current room

### Viewing Event History

**Previously Used Events**:
1. Click **"Room Selector"** dropdown
2. All previously created events shown
3. Shows: Room name, number of timers, last used
4. Click room to switch to it

---

## Controlling Timers

### Starting Timer

**Begin Countdown**:
1. Current timer shown in large countdown display (left side)
2. Click **"Play"** button (green play icon)
3. Countdown starts: 45:00 → 44:59 → 44:58...
4. Progress bar appears at top of Stage Display
5. Play button changes to **"Pause"**

**What Happens**:
- All Stage Displays show synchronized countdown
- Timer updates every 1 second
- Progress bar fills as time remaining decreases
- All connected displays sync within <150ms

### Pausing Timer

**Pause Countdown**:
1. If timer running, click **"Pause"** button
2. Countdown stops on all displays
3. Remaining time frozen (e.g., 23:45)
4. Pause button changes to **"Play"**

**Resume Countdown**:
1. Click **"Play"** button again
2. Countdown resumes from where it stopped
3. Progress bar continues filling

### Adjusting Time

**Add Time**:
- Click **"+1m"** button to add 1 minute (60 seconds)
- Useful if running behind schedule
- Instantly updates all displays

**Subtract Time**:
- Click **"-1m"** button to subtract 1 minute
- Useful if ahead of schedule
- Caution: Don't subtract more than remaining time

**Examples**:
- Timer showing 10:23, click "-1m" → now shows 09:23
- Timer showing 15:00, click "+1m" → now shows 16:00
- Click "+1m" twice → add 2 minutes total

### Moving to Next Timer

**Skip to Next Segment**:
1. Current segment ending soon or not needed
2. Click **"Next Timer"** button
3. Current timer stops
4. Next timer becomes active
5. If playing, countdown continues automatically
6. Example: After "Keynote" (45:00), jump to "Break" (15:00)

**What Happens**:
- Previous timer stops
- New timer starts
- Progress bar resets (100% full)
- Countdown shows new duration
- All displays update automatically

### Loop Feature (if available)

**After Last Timer**:
- When last timer ends, countdown stops at 00:00
- Stage Display shows "00:00"
- To start over: Click **"First Timer"** button or switch rooms

---

## Display Messages

### Sending Simple Message

**Show Text on All Displays**:
1. Locate **"Message Text"** field (right column)
2. Type your message:
   - Max 255 characters
   - Examples: "Welcome to the conference!", "5 minute break", "Transitioning to next session..."
3. Click **"Show"** button
4. Message appears on all Stage Displays
5. Message persists until you click "Hide"

**Character Counter**:
- Shows below text field: "23/255"
- Larger numbers appear as you type
- Turns orange as you approach 255 limit
- Can't send if exceeding 255 characters

### Formatting Messages

**Add Color**:
1. Type your message
2. Click color swatch (8 colors available):
   - Red, Orange, Yellow, Green, Cyan, Blue, Purple, White
3. Selected color shown on swatch
4. Click "Show" button
5. Message appears in that color on all displays

**Make Bold**:
1. Type message
2. Check **"Bold"** checkbox
3. Text appears bold on displays
4. Click "Show"

**Change Font Size**:
1. Type message
2. Select size from dropdown:
   - **Small** (24px) - for detailed text
   - **Medium** (32px) - for general announcements
   - **Large** (48px) - for important messages
   - **Extra Large** (64px) - for emergency alerts
3. Click "Show"

### Message Preview

**See Before Sending**:
- **Preview Window** (left column) shows exactly how message appears
- Updates in real-time as you adjust formatting
- Same size and styling as Stage Display will show
- Confirm looks good before clicking "Show"

### Common Messages

**Opening**:
```
Message: "WELCOME TO TECH SUMMIT 2026"
Color: Blue
Bold: Yes
Size: Extra Large (64px)
```

**Break Time**:
```
Message: "15 MINUTE BREAK - REFRESHMENTS IN LOBBY"
Color: Green
Bold: Yes
Size: Large (48px)
```

**Alert**:
```
Message: "PLEASE RETURN TO SEATS - SESSION STARTING IN 2 MINUTES"
Color: Red
Bold: Yes
Size: Extra Large (64px)
```

**Q&A Session**:
```
Message: "QUESTION & ANSWER SESSION NOW OPEN"
Color: Cyan
Bold: Yes
Size: Large (48px)
```

### Hiding Messages

**Remove Message from Displays**:
1. Click **"Hide"** button
2. Message disappears from all Stage Displays
3. Countdown and progress bar visible again

### Message Queue

**Quick Access to Recent Messages**:
- Below message input: "Message Queue" list
- Shows 5 most recent messages
- Click message in queue to quick-show again
- Useful for repeating messages without retyping

---

## Special Effects

### Blackout (Dark Screen)

**When to Use**:
- Hide display between segments
- Privacy during planning/discussion
- Dramatic reveal

**Apply Blackout**:
1. Click **"Blackout"** button
2. All Stage Displays go completely black:
   - Countdown hidden
   - Progress bar hidden
   - Time-of-day hidden
   - Message hidden
3. Timer **continues running** (behind the scenes)
4. Button changes to **"Unblackout"**

**Remove Blackout**:
1. Click **"Unblackout"** button
2. Displays return to normal
3. Shows countdown from wherever timer was

**Example Use**:
- Keynoter arrives on stage, click Blackout
- Adjustments made, screen dark
- Ready for presentation, click Unblackout
- Countdown appears, synchronizes with audio/lights

### Flash (Attention Signal)

**When to Use**:
- Get audience attention
- Signal transition
- Emergency alert
- Wake up sleeping attendees 😊

**Trigger Flash**:
1. Click **"Flash"** button
2. All Stage Displays flash white for 500ms (half second)
3. Returns to normal countdown display
4. Happens instantly, no confirmation

**Works During**:
- Normal display: Flashes over countdown
- Blackout: White flash visible even on black screen
- Message display: Flashes over message
- During pause: Works anytime

**Example Use**:
- Session ending in 1 minute, click Flash
- Gets audience attention
- Message appears: "PLEASE WRAP UP"

### Combined Effects

**Blackout + Flash**:
1. Click "Blackout" (screen goes black)
2. Timer runs in background (invisible)
3. Click "Flash" (brief white flash visible on black)
4. Returns to black
5. Click "Unblackout" (reveals final countdown)

---

## Tips & Tricks

### Organize Timers Efficiently

**Before Event**:
1. Plan event timeline on paper
2. Calculate segment durations
3. Add some buffer time
4. Test all timers before event starts

**Buffer Time Example**:
```
Registration:        15:00
Keynote:            45:00
Buffer-Keynote:     05:00 (in case runs long)
Break:              15:00
Sessions:           60:00
Closing Buffer:     05:00 (in case earlier segments run long)
Closing Remarks:    15:00
```

### Quick Timer Adjustments

**Getting Behind Schedule**:
1. Click "+1m" to add time
2. Can adjust multiple timers
3. Keep event on track without stress

**Getting Ahead**:
1. Click "-1m" to remove time
2. Keep audience engaged
3. Transition smoothly to next segment

### Message Strategy

**Timeline of Messages**:
```
Start of segment:   Welcome message (blue, 48px)
Midpoint:          Progress message (green, 32px)
5 min remaining:    "5 minutes remaining" (orange, 48px)
1 min remaining:    "1 minute remaining" (red, 64px)
Time's up/Ending:   Transition message (blue, 64px)
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Spacebar | Toggle Play/Pause |
| ? | Show help |
| Esc | Close dialogs |
| Tab | Navigate controls |

### Monitor Display Count

**Connection Indicator**:
- Shows in header: "Live Connections: 2 displays"
- Updates real-time
- Green = connected
- Red = disconnected
- If count is 0, no displays connected (warning!)

**Verify Before Starting**:
- Check display count before starting timer
- Example: Should show "3 displays" if 3 projectors
- Wait for all displays to connect before starting

### Backup Plans

**If Display Disconnects**:
1. Check WiFi on display device
2. Reload page (F5) on display
3. Re-enter room ID if needed

**If Control Dashboard Freezes**:
1. Reload page (F5) on Control Dashboard
2. Timers continue on Stage Displays
3. Reconnect and resume control

---

## Troubleshooting

### Display Not Showing

**Symptom**: Stage Display shows nothing (black screen)

**Solutions**:
1. Check if page loaded: Wait 5 seconds
2. Refresh page: Press F5
3. Check URL: Should be `https://yourdomain.com/stage.html?room=1`
4. Check internet: Reload page
5. Check browser compatibility: Use Chrome or Firefox

### Countdown Not Starting

**Symptom**: Click "Play" but countdown doesn't start

**Solutions**:
1. Check connection indicator (should be green)
2. Verify display counter shows > 0
3. Try refreshing Control Dashboard (F5)
4. Check browser console for errors (F12)
5. Reload Stage Display (F5)

### Countdown Looks Frozen

**Symptom**: Timer shows time but doesn't update

**Solutions**:
1. Wait 5 seconds (updates every 1 second)
2. Refresh Stage Display: Press F5
3. Check connection indicator (green = good)
4. Try clicking Pause then Play

### Message Doesn't Appear

**Symptom**: Typed message, clicked Show, but nothing appears on display

**Solutions**:
1. Check display counter (should show > 0)
2. Reload Stage Display (F5)
3. Clear message cache: Click Hide, then Show again
4. Try different message text
5. Check browser console for errors (F12)

### Disconnected Warning

**Symptom**: Connection indicator shows red/disconnected

**Solutions**:
1. Check internet connection on Control Dashboard
2. Check internet on Stage Display
3. Reload page (F5) on both devices
4. Check if Pusher is reachable: might need VPN
5. Wait 10 seconds (auto-reconnect attempts)

### Timers Not Saving

**Symptom**: Create timers, close browser, they're gone

**Solutions**:
1. Click "Save Changes" before closing
2. Wait for green confirmation
3. Check for error messages
4. Try creating room in different browser
5. Check database connection: Click "Health Check" link

### Performance Sluggish

**Symptom**: Control Dashboard or Stage Display feels slow

**Solutions**:
1. Close other browser tabs
2. Close other applications
3. Reload page (F5)
4. Restart browser
5. Reduce number of open Stage Displays
6. Check internet speed: should be >5 Mbps

### Browser Compatibility Issues

**Recommended Browsers**:
- Chrome (latest) - Best compatibility
- Firefox (latest) - Good compatibility
- Safari (latest) - Good compatibility
- Edge (latest) - Good compatibility

**Not Recommended**:
- Internet Explorer (too old)
- Very old browser versions

---

## Emergency Procedures

### If Everything Freezes

**Recovery Steps**:
1. Take deep breath
2. Reload Control Dashboard: F5
3. Reload Stage Display: F5
4. If still frozen, restart browser
5. Timers may have paused - resume manually

### If Display Goes Black

**Troubleshooting**:
1. Check if **Blackout** button was accidentally clicked
   - Look on Control Dashboard for "Unblackout" button
   - Click if present (displays will return)
2. If not blackout:
   - Reload Stage Display: F5
   - Check internet connection
   - Restart device if needed

### If Real Emergency (fire alarm, etc.)

**Quick Stop**:
1. Click **"Pause"** button (stops countdown)
2. Click **"Blackout"** button (hides all displays)
3. Or simply close Stage Display windows

**Resume After**:
1. Reload all pages (F5)
2. System resumes from where it paused
3. Continue event

---

## Best Practices

### Before Event (30 minutes)

- [ ] Test Control Dashboard loads
- [ ] Test Stage Display loads
- [ ] Test all Stage Display connections
- [ ] Verify display counter shows correct number
- [ ] Test Play/Pause
- [ ] Send test message to all displays
- [ ] Test Blackout/Flash
- [ ] Run through complete event flow

### During Event

- [ ] Monitor connection indicator (should stay green)
- [ ] Glance at display count periodically
- [ ] Use messages for transitions
- [ ] Don't make drastic time adjustments
- [ ] Have backup plan for each segment

### After Event

- [ ] Save final state
- [ ] Note any issues for next time
- [ ] Close all browser tabs
- [ ] Shutdown display devices
- [ ] Remember room for future use

---

## Support

### Getting Help

1. **Reread This Manual** - Most answers here
2. **Check Troubleshooting Section** - Your specific issue
3. **Ask IT Department** - They have full documentation
4. **Email Support** - For complex issues: support@yourdomain.com

### Emergency Contact

- **Tech Support**: +1-555-HELP-NOW
- **On-Call**: Leave message, respond within 15 minutes
- **Email**: support@yourdomain.com (2-hour response)

---

## Glossary

| Term | Definition |
|------|-----------|
| Room | Container for all timers in an event |
| Timer | Individual time segment (e.g., "Welcome Speech") |
| Duration | Length of timer (MM:SS format) |
| Control Dashboard | Operator interface to manage timers |
| Stage Display | Screen shown to audience |
| Countdown | Decreasing time display (45:00 → 00:00) |
| Progress Bar | Visual indicator of time remaining |
| Blackout | Black screen mode |
| Flash | Brief white screen pulse |
| Connection | Real-time sync between devices |
| Broadcast | Sending message to all displays |

---

**Operator Manual Version**: 1.0  
**Last Updated**: March 19, 2026  
**Questions?** Refer to SYSTEM_DOCUMENTATION.md for technical details

**Happy Operating! 🎉**

