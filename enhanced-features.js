// ============================================
// ENHANCED FEATURES FOR CAREPRO
// ============================================

// 1. FAVORITES SYSTEM
async function toggleFavoriteBabysitter(babysitterId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        alert('Please login to use favorites');
        return;
    }

    if (currentUser.role !== 'parent') {
        alert('Only parents can favorite babysitters');
        return;
    }

    let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    const isFavorited = favorites.includes(babysitterId);
    
    if (isFavorited) {
        favorites = favorites.filter(id => id !== babysitterId);
    } else {
        favorites.push(babysitterId);
    }
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    const newState = favorites.includes(babysitterId);
    
    // Update all favorite buttons on the page
    updateFavoriteButtons();
    
    // Update the specific button if on profile page
    const favBtn = document.getElementById('favBtn');
    if (favBtn) {
        if (newState) {
            favBtn.innerHTML = '★ Favorited';
            favBtn.style.background = '#fbbf24';
            favBtn.style.color = 'white';
            favBtn.style.borderColor = '#fbbf24';
        } else {
            favBtn.innerHTML = '☆ Favorite';
            favBtn.style.background = 'white';
            favBtn.style.color = 'var(--primary)';
            favBtn.style.borderColor = 'var(--primary)';
        }
    }
    
    return newState;
}

// Update favorite button appearance across the page
function updateFavoriteButtons() {
    const favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    
    // Update all favorite buttons (use data-sitter-id as the standard)
    document.querySelectorAll('[data-sitter-id]').forEach(btn => {
        const sitterId = btn.getAttribute('data-sitter-id');
        if (btn.classList.contains('fav-btn')) {
            // Small star button in favorites page
            if (favorites.includes(sitterId)) {
                btn.innerHTML = '★';
                btn.style.color = '#fbbf24';
            } else {
                btn.innerHTML = '☆';
                btn.style.color = 'var(--primary)';
            }
        } else {
            // Large button in search results
            if (favorites.includes(sitterId)) {
                btn.innerHTML = '★ Favorited';
                btn.style.background = '#fbbf24';
                btn.style.color = 'white';
            } else {
                btn.innerHTML = '☆ Favorite';
                btn.style.background = 'white';
                btn.style.color = 'var(--primary)';
            }
        }
    });
}

function updateFavoriteButtons() {
    const favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    document.querySelectorAll('[data-sitter-id]').forEach(card => {
        const sitterId = card.dataset.sitterId;
        const favBtn = card.querySelector('.fav-btn');
        if (favBtn) {
            favBtn.textContent = favorites.includes(sitterId) ? '★' : '☆';
            favBtn.style.color = favorites.includes(sitterId) ? '#fbbf24' : 'var(--primary)';
        }
    });
}

// 2. SEARCH HISTORY
function addToSearchHistory(query) {
    if (!query) return;
    let history = JSON.parse(localStorage.getItem('searchHistory')) || [];
    history = [query, ...history.filter(h => h !== query)].slice(0, 10);
    localStorage.setItem('searchHistory', JSON.stringify(history));
}

function getSearchHistory() {
    return JSON.parse(localStorage.getItem('searchHistory')) || [];
}

// 3. QUICK BOOKING FOR REPEAT SITTERS
async function quickBookBabysitter(babysitterId) {
    try {
        const { data } = await supabaseClient
            .from('users')
            .select('name, hourly_rate')
            .eq('id', babysitterId)
            .single();

        if (data) {
            localStorage.setItem('selectedBabysitter', JSON.stringify({
                id: babysitterId,
                name: data.name,
                hourly_rate: data.hourly_rate
            }));
            window.location.href = 'booking.html';
        }
    } catch (error) {
        console.error('Error quick booking:', error);
    }
}

// 4. BOOKING CONFIRMATION CODE
function generateConfirmationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// 5. BABYSITTER BADGES
async function loadBabysitterBadges(babysitterId) {
    try {
        const { data: userData } = await supabaseClient
            .from('users')
            .select('certified, years_experience, created_at')
            .eq('id', babysitterId)
            .single();

        if (!userData) return [];

        const badges = [];
        
        if (userData.certified) badges.push({ text: '✓ CPR Certified', color: '#10b981' });
        if (userData.years_experience >= 5) badges.push({ text: '⭐ 5+ Years', color: '#f59e0b' });
        if (userData.years_experience >= 10) badges.push({ text: '⭐ Super Sitter', color: '#f59e0b' });
        
        // Check if super sitter (high rating + many bookings)
        const { data: reviews } = await supabaseClient
            .from('reviews')
            .select('rating')
            .eq('babysitter_id', babysitterId);

        if (reviews && reviews.length >= 10) {
            const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            if (avgRating >= 4.8) badges.push({ text: '🌟 Super Sitter', color: '#f59e0b' });
        }

        // Check if new member
        const joinDate = new Date(userData.created_at);
        const daysOld = (new Date() - joinDate) / (1000 * 60 * 60 * 24);
        if (daysOld < 30) badges.push({ text: '🆕 New Member', color: '#8b5cf6' });

        return badges;
    } catch (error) {
        console.error('Error loading badges:', error);
        return [];
    }
}

// 6. RESPONSE TIME TRACKER
async function recordResponseTime(babysitterId, responseMinutes) {
    try {
        const { error } = await supabaseClient
            .from('babysitter_stats')
            .insert([{
                babysitter_id: babysitterId,
                response_minutes: responseMinutes,
                recorded_at: new Date().toISOString()
            }]);
    } catch (error) {
        console.error('Error recording response time:', error);
    }
}

async function getAverageResponseTime(babysitterId) {
    try {
        const { data } = await supabaseClient
            .from('babysitter_stats')
            .select('response_minutes')
            .eq('babysitter_id', babysitterId)
            .order('recorded_at', { ascending: false })
            .limit(10);

        if (!data || data.length === 0) return null;
        
        const average = data.reduce((sum, s) => sum + s.response_minutes, 0) / data.length;
        return Math.round(average);
    } catch (error) {
        console.error('Error getting response time:', error);
        return null;
    }
}

// 7. SPECIAL SKILLS DISPLAY
function displaySpecialSkills(skills) {
    if (!skills) return '';
    return skills.split(',').map(skill => `<span style="background: var(--neutral-light); padding: 4px 8px; border-radius: 12px; font-size: 12px; margin-right: 5px; display: inline-block;">${skill.trim()}</span>`).join('');
}

// 8. BOOKING REMINDER
function setBookingReminder(bookingId, bookingDateTime) {
    const remindTime = new Date(bookingDateTime);
    remindTime.setHours(remindTime.getHours() - 2); // Remind 2 hours before

    const now = new Date();
    const timeUntilReminder = remindTime - now;

    if (timeUntilReminder > 0) {
        setTimeout(() => {
            if (Notification.permission === 'granted') {
                new Notification('CarePro Booking Reminder', {
                    body: `Your booking is in 2 hours!`,
                    tag: `booking-${bookingId}`
                });
            }
        }, timeUntilReminder);
    }
}

// 9. REQUEST BROWSER NOTIFICATION PERMISSION
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// 10. ESTIMATE TIME TO FIRST RESPONSE
function estimateResponseTime(babysitterId) {
    const responseMap = {
        'excellent': '< 5 min',
        'good': '5-15 min',
        'average': '15-30 min',
        'slow': '> 30 min'
    };
    return responseMap['good']; // Default to good
}

// 11. PROFILE COMPLETION PERCENTAGE
function calculateProfileCompletion(userObject) {
    let completed = 0;
    let total = 5;

    if (userObject.name) completed++;
    if (userObject.email) completed++;
    if (userObject.bio) completed++;
    if (userObject.location) completed++;
    if (userObject.hourly_rate) completed++;

    if (userObject.role === 'babysitter') {
        total += 3;
        if (userObject.years_experience) completed++;
        if (userObject.certified) completed++;
        if (userObject.languages) completed++;
    }

    return Math.round((completed / total) * 100);
}

// 12. CANCELLATION HISTORY
async function getCancellationHistory(userId) {
    try {
        const { data } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq('parent_id', userId)
            .eq('status', 'cancelled')
            .order('booking_date', { ascending: false })
            .limit(10);

        return data || [];
    } catch (error) {
        console.error('Error getting cancellation history:', error);
        return [];
    }
}

// 13. RECENT ACTIVITY BADGE
function getRecentActivityBadge(lastBookingDate) {
    if (!lastBookingDate) return null;
    
    const lastDate = new Date(lastBookingDate);
    const daysAgo = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
    
    if (daysAgo === 0) return { text: '🔥 Booked Today', color: '#ef4444' };
    if (daysAgo === 1) return { text: '🔥 Booked Yesterday', color: '#f97316' };
    if (daysAgo <= 7) return { text: '⚡ Recently Booked', color: '#f59e0b' };
    if (daysAgo <= 30) return { text: '✓ Active', color: '#10b981' };
    return null;
}

// 14. LANGUAGE SUPPORT DISPLAY
async function getBabysitterLanguages(babysitterId) {
    try {
        const { data } = await supabaseClient
            .from('users')
            .select('languages')
            .eq('id', babysitterId)
            .single();

        return data?.languages?.split(',').map(l => l.trim()) || ['English'];
    } catch (error) {
        return ['English'];
    }
}

// 15. AGE RANGE SPECIALIZATION
function getAgeRangeLabel(minAge, maxAge) {
    const ranges = {
        '0-2': 'Infants & Toddlers',
        '3-5': 'Preschoolers',
        '6-12': 'School Age',
        '13+': 'Teens'
    };
    return `${minAge}-${maxAge} months` || 'All ages';
}

// 16. QUICK STATS CARD
function createQuickStatsCard(babysitterId, name, rating, bookings, responseTime) {
    return `
        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid var(--neutral-border); display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 13px;">
            <div style="text-align: center;">
                <p style="margin: 0; color: var(--text-secondary); font-size: 11px;">Rating</p>
                <p style="margin: 5px 0 0 0; color: var(--primary); font-weight: 700;">${rating}★</p>
            </div>
            <div style="text-align: center;">
                <p style="margin: 0; color: var(--text-secondary); font-size: 11px;">Bookings</p>
                <p style="margin: 5px 0 0 0; color: var(--primary); font-weight: 700;">${bookings}</p>
            </div>
            <div style="text-align: center;">
                <p style="margin: 0; color: var(--text-secondary); font-size: 11px;">Response</p>
                <p style="margin: 5px 0 0 0; color: var(--primary); font-weight: 700;">${responseTime}m</p>
            </div>
            <div style="text-align: center;">
                <p style="margin: 0; color: var(--text-secondary); font-size: 11px;">Rate</p>
                <p style="margin: 5px 0 0 0; color: var(--primary); font-weight: 700;">£${name}</p>
            </div>
        </div>
    `;
}

// 17. DARK MODE TOGGLE
function toggleDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    localStorage.setItem('darkMode', !isDark);
    
    const root = document.documentElement;
    if (!isDark) {
        root.style.filter = 'invert(1) hue-rotate(180deg)';
    } else {
        root.style.filter = 'none';
    }
}

function loadDarkModePreference() {
    if (localStorage.getItem('darkMode') === 'true') {
        document.documentElement.style.filter = 'invert(1) hue-rotate(180deg)';
    }
}

// 18. MESSAGE UNREAD COUNT
async function getUnreadMessageCount(userId) {
    try {
        const { data } = await supabaseClient
            .from('messages')
            .select('id')
            .eq('recipient_id', userId)
            .eq('read', false);

        return data?.length || 0;
    } catch (error) {
        return 0;
    }
}

// 19. PRICE CALCULATOR WITH EXTRAS
function calculatePriceWithExtras(hourlyRate, hours, extras = {}) {
    let total = hourlyRate * hours;
    
    // Extra charges
    if (extras.nightShift) total *= 1.25; // 25% extra for night shifts (after 9pm)
    if (extras.weekendRate) total *= 1.15; // 15% extra for weekends
    if (extras.multipleChildren) total += extras.multipleChildren * 2; // £2 per extra child
    if (extras.specialNeeds) total *= 1.3; // 30% extra for special needs care
    
    return total.toFixed(2);
}

// 20. INSTANT BOOKING CONFIRMATION
function showInstantBookingConfirmation(confirmationCode, babysitterName, dateTime) {
    const confirmHTML = `
        <div style="background: var(--success); color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0;">✓ Booking Confirmed!</h3>
            <p style="margin: 5px 0;">Confirmation Code: <strong>${confirmationCode}</strong></p>
            <p style="margin: 5px 0;">${babysitterName} will receive your booking request and respond shortly.</p>
            <p style="margin: 5px 0; font-size: 13px;">Booking for: ${dateTime}</p>
        </div>
    `;
    return confirmHTML;
}

// Initialize enhancements on page load
document.addEventListener('DOMContentLoaded', function() {
    updateFavoriteButtons();
    requestNotificationPermission();
    loadDarkModePreference();
});
