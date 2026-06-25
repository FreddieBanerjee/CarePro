// google-calendar.js
// Google Calendar Integration Module for CarePro
// Allows babysitters to sync their Google Calendar to availability

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const GOOGLE_CLIENT_ID = '206235759788-6acurbabslbgmfk3e8q4e28320ous9ne.apps.googleusercontent.com.apps.googleusercontent.com'; // Replace with your Client ID from Google Cloud
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_API_KEY = 'YOUR_API_KEY'; // Optional: for public API calls

// Get redirect URI from current domain
const GOOGLE_REDIRECT_URI = window.location.origin + '/google-calendar-callback.html';

// ============================================
// STEP 1: INITIATE GOOGLE LOGIN
// ============================================
async function connectGoogleCalendar() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    // Verify user is logged in and is a babysitter
    if (!currentUser) {
        alert('Please login first');
        window.location.href = 'login.html';
        return;
    }

    if (currentUser.role !== 'babysitter') {
        alert('Only babysitters can connect Google Calendar');
        return;
    }

    // Generate state for security
    const state = generateRandomString(32);
    localStorage.setItem('googleAuthState', state);
    localStorage.setItem('googleAuthUserId', currentUser.id);
    localStorage.setItem('googleAuthTimestamp', Date.now().toString());

    // Build Google OAuth URL
    const googleAuthUrl = buildGoogleAuthUrl(state);
    
    console.log('Redirecting to Google OAuth...');
    window.location.href = googleAuthUrl;
}

// ============================================
// STEP 2: HANDLE OAUTH CALLBACK
// ============================================
async function handleGoogleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    console.log('Google OAuth callback received', { code: !!code, state, error });

    // Check for user denial
    if (error) {
        alert('Google Calendar authorization denied: ' + error);
        window.location.href = 'user-profile.html';
        return;
    }

    // Verify state for security
    const savedState = localStorage.getItem('googleAuthState');
    if (state !== savedState) {
        alert('Security error: Invalid state. Please try again.');
        window.location.href = 'user-profile.html';
        return;
    }

    // Check if state is too old (older than 10 minutes)
    const timestamp = parseInt(localStorage.getItem('googleAuthTimestamp') || '0');
    if (Date.now() - timestamp > 10 * 60 * 1000) {
        alert('Authorization expired. Please try again.');
        window.location.href = 'user-profile.html';
        return;
    }

    if (!code) {
        alert('No authorization code received');
        window.location.href = 'user-profile.html';
        return;
    }

    // Show loading indicator
    showLoadingDialog('Authorizing Google Calendar...');

    try {
        // Exchange code for tokens via backend
        const userId = localStorage.getItem('googleAuthUserId');
        const response = await fetch('/.netlify/functions/google-calendar-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                userId: userId,
                redirectUri: GOOGLE_REDIRECT_URI
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to authorize Google Calendar');
        }

        // Save tokens to user record
        await saveGoogleCalendarTokens(userId, data.accessToken);

        // Sync calendar events immediately
        await syncGoogleCalendarToAvailability();

        hideLoadingDialog();
        alert('✓ Google Calendar connected successfully!');
        window.location.href = 'user-profile.html';

    } catch (error) {
        hideLoadingDialog();
        console.error('OAuth callback error:', error);
        alert('Error: ' + error.message);
        window.location.href = 'user-profile.html';
    } finally {
        // Clean up localStorage
        localStorage.removeItem('googleAuthState');
        localStorage.removeItem('googleAuthUserId');
        localStorage.removeItem('googleAuthTimestamp');
    }
}

// ============================================
// STEP 3: EXCHANGE CODE FOR ACCESS TOKEN
// ============================================
async function exchangeCodeForAccessToken(code) {
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code,
                client_id: GOOGLE_CLIENT_ID,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            }).toString()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error_description || 'Failed to exchange code');
        }

        const data = await response.json();
        return data.access_token;

    } catch (error) {
        console.error('Token exchange error:', error);
        throw error;
    }
}

// ============================================
// STEP 4: SAVE TOKENS TO DATABASE
// ============================================
async function saveGoogleCalendarTokens(userId, accessToken) {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));

        const { error } = await supabaseClient
            .from('users')
            .update({
                google_calendar_connected: true,
                google_calendar_token: accessToken,
                google_calendar_synced_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) throw error;

        // Update local storage
        currentUser.google_calendar_connected = true;
        currentUser.google_calendar_token = accessToken;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        console.log('Google Calendar token saved');
    } catch (error) {
        console.error('Error saving tokens:', error);
        throw error;
    }
}

// ============================================
// STEP 5: FETCH GOOGLE CALENDAR EVENTS
// ============================================
async function fetchGoogleCalendarEvents(accessToken, daysAhead = 30) {
    try {
        const now = new Date();
        const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

        const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
            `timeMin=${now.toISOString()}&` +
            `timeMax=${futureDate.toISOString()}&` +
            `singleEvents=true&` +
            `orderBy=startTime`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Google Calendar access expired. Please reconnect.');
            }
            throw new Error(`Google Calendar API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Fetched ${data.items?.length || 0} events from Google Calendar`);
        return data.items || [];

    } catch (error) {
        console.error('Error fetching Google Calendar events:', error);
        throw error;
    }
}

// ============================================
// STEP 6: CONVERT GOOGLE EVENTS TO AVAILABILITY
// ============================================
function convertGoogleEventsToAvailability(googleEvents, babysitterId) {
    const slots = [];

    googleEvents.forEach(event => {
        // Skip events without time info
        if (!event.start || !event.end) return;

        // Skip all-day events (we can't determine exact hours)
        if (!event.start.dateTime) {
            console.log('Skipping all-day event:', event.summary);
            return;
        }

        const startDate = new Date(event.start.dateTime);
        const endDate = new Date(event.end.dateTime);

        // Determine if busy or free
        // By default, events are busy unless explicitly marked as "transparent"
        const isBusy = event.transparency !== 'transparent';

        console.log(`Processing event: "${event.summary}" (${startDate.toLocaleString()} - ${endDate.toLocaleString()}) - ${isBusy ? 'BUSY' : 'FREE'}`);

        // Create hourly slots for the event duration
        const current = new Date(startDate);
        while (current < endDate) {
            const dateStr = current.toISOString().split('T')[0]; // YYYY-MM-DD
            const hour = current.getHours(); // 0-23

            slots.push({
                babysitter_id: babysitterId,
                available_date: dateStr,
                hour_start: hour,
                is_available: !isBusy, // Opposite of busy status
                is_booked: false,
                synced_from_google_calendar: true,
                google_event_id: event.id,
                google_event_title: event.summary || 'Untitled',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            // Move to next hour
            current.setHours(current.getHours() + 1);
        }
    });

    return slots;
}

// ============================================
// STEP 7: SYNC EVENTS TO AVAILABILITY TABLE
// ============================================
async function syncGoogleCalendarToAvailability() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (!currentUser || !currentUser.google_calendar_token) {
        alert('Google Calendar not connected');
        return false;
    }

    showLoadingDialog('Syncing Google Calendar events...');

    try {
        // Fetch Google Calendar events
        const googleEvents = await fetchGoogleCalendarEvents(currentUser.google_calendar_token, 30);

        if (!googleEvents || googleEvents.length === 0) {
            hideLoadingDialog();
            alert('No events found in your Google Calendar for the next 30 days');
            return false;
        }

        console.log(`Found ${googleEvents.length} events to sync`);

        // Convert to CarePro availability format
        const availabilitySlots = convertGoogleEventsToAvailability(googleEvents, currentUser.id);

        console.log(`Converted to ${availabilitySlots.length} availability slots`);

        // Save to Supabase
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < availabilitySlots.length; i++) {
            const slot = availabilitySlots[i];

            try {
                // Check if slot already exists
                const { data: existing, error: selectError } = await supabaseClient
                    .from('availability')
                    .select('id')
                    .eq('babysitter_id', currentUser.id)
                    .eq('available_date', slot.available_date)
                    .eq('hour_start', slot.hour_start)
                    .single();

                if (existing && !selectError) {
                    // Update existing slot
                    await supabaseClient
                        .from('availability')
                        .update({
                            is_available: slot.is_available,
                            synced_from_google_calendar: true,
                            google_event_id: slot.google_event_id,
                            google_event_title: slot.google_event_title,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id);
                } else {
                    // Create new slot
                    const { error: insertError } = await supabaseClient
                        .from('availability')
                        .insert([slot]);

                    if (insertError) throw insertError;
                }

                successCount++;

                // Update progress UI
                updateSyncProgress(successCount, availabilitySlots.length);

            } catch (error) {
                console.error(`Error saving slot ${slot.available_date} ${slot.hour_start}:00`, error);
                errorCount++;
            }
        }

        hideLoadingDialog();

        const message = `✓ Synced ${successCount} time slots from Google Calendar`;
        if (errorCount > 0) {
            alert(message + `\n(${errorCount} errors)`, 'warning');
        } else {
            alert(message);
        }

        return true;

    } catch (error) {
        hideLoadingDialog();
        console.error('Error syncing calendar:', error);
        alert('Error syncing calendar: ' + error.message, 'error');
        return false;
    }
}

// ============================================
// STEP 8: DISCONNECT GOOGLE CALENDAR
// ============================================
async function disconnectGoogleCalendar() {
    if (!confirm('Disconnect Google Calendar? Your availability will no longer sync automatically.')) {
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    try {
        const { error } = await supabaseClient
            .from('users')
            .update({
                google_calendar_connected: false,
                google_calendar_token: null
            })
            .eq('id', currentUser.id);

        if (error) throw error;

        // Update local storage
        currentUser.google_calendar_connected = false;
        currentUser.google_calendar_token = null;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        alert('✓ Google Calendar disconnected');
        updateGoogleCalendarUIStatus();

    } catch (error) {
        console.error('Error disconnecting:', error);
        alert('Error: ' + error.message);
    }
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

function updateGoogleCalendarUIStatus() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const isConnected = currentUser?.google_calendar_connected === true;

    const statusDiv = document.getElementById('googleCalendarStatus');
    const button = document.getElementById('googleCalendarBtn');
    const syncBtn = document.getElementById('googleCalendarSyncBtn');

    if (statusDiv && button) {
        if (isConnected) {
            statusDiv.style.display = 'block';
            button.style.display = 'none';
        } else {
            statusDiv.style.display = 'none';
            button.style.display = 'block';
        }
    }

    if (syncBtn) {
        syncBtn.style.display = isConnected ? 'block' : 'none';
    }
}

function updateSyncProgress(current, total) {
    const syncCount = document.getElementById('syncCount');
    if (syncCount) {
        syncCount.textContent = `${current}/${total}`;
    }
}

function showLoadingDialog(message) {
    let dialog = document.getElementById('googleCalendarLoadingDialog');
    
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'googleCalendarLoadingDialog';
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        document.body.appendChild(dialog);
    }

    dialog.innerHTML = `
        <div style="background: white; padding: 24px; border-radius: 12px; text-align: center;">
            <div style="margin-bottom: 16px;">
                <div style="width: 40px; height: 40px; border: 4px solid #059669; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;" id="spinner"></div>
            </div>
            <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: 500;">${escapeHTML(message)}</p>
        </div>
    `;

    dialog.style.display = 'flex';

    // Add spinner animation
    if (!document.querySelector('style[data-spinner-animation]')) {
        const style = document.createElement('style');
        style.setAttribute('data-spinner-animation', 'true');
        style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }
}

function hideLoadingDialog() {
    const dialog = document.getElementById('googleCalendarLoadingDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function buildGoogleAuthUrl(state) {
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: GOOGLE_SCOPES,
        access_type: 'offline',
        state: state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Update UI status on page load
    updateGoogleCalendarUIStatus();

    // Handle OAuth callback if URL contains code
    if (window.location.search.includes('code=')) {
        handleGoogleOAuthCallback();
    }
});

console.log('Google Calendar integration loaded');
