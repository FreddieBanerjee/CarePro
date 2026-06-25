// CarePro - Core JavaScript Functions

// Smart dashboard redirect based on user role
function goToDashboard() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    if (currentUser.role === 'babysitter') {
        window.location.href = 'babysitter-dashboard.html';
    } else {
        window.location.href = 'dashboard.html';
    }
}

// Check if user is already logged in
function checkPersistentLogin() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser && currentUser.id) {
        // User is logged in, redirect to appropriate dashboard
        if (currentUser.role === 'babysitter') {
            window.location.href = 'babysitter-dashboard.html';
        } else if (currentUser.role === 'parent') {
            window.location.href = 'dashboard.html';
        }
    }
}

// User Authentication
async function loginUser() {
    const email = document.querySelector('input[type="email"]').value;
    const password = document.querySelector('input[type="password"]').value;

    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !data) {
            alert('User not found');
            return;
        }

        // In production, use proper password hashing
        if (data.password !== password) {
            alert('Incorrect password');
            return;
        }
        // Check if user is banned or suspended
        if (data.status === 'banned') {
            alert('Your account has been banned. Please contact support.');
            return;
        }

        if (data.status === 'suspended') {
            alert('Your account is suspended. Please contact support.');
            return;
        }

        // Store user data for persistent login
        localStorage.setItem('currentUser', JSON.stringify(data));
        localStorage.setItem('loginTime', new Date().toISOString());
        
        if (data.role === 'admin') {
            window.location.href = 'moderation.html';
        } else if (data.role === 'babysitter') {
            window.location.href = 'babysitter-dashboard.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Error: ' + error.message);
    }
}

async function signupUser() {
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('emailAddress').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const accountRole = document.getElementById('accountRole').value;
    const location = document.getElementById('locationInput').value;
    const address = document.getElementById('address').value;
    const postcode = document.getElementById('postcode').value;
    const phone = document.getElementById('phone').value;

    // Validate all required fields
    if (!fullName || !email || !password || !confirmPassword || !accountRole || !address || !postcode || !phone) {
        alert('Please fill in all required fields');
        return;
    }

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    // Validate UK postcode format
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    if (!postcodeRegex.test(postcode)) {
        document.getElementById('postcodeError').style.display = 'block';
        alert('Please enter a valid UK postcode (e.g., SW1A 1AA)');
        return;
    }

    // Validate phone number (basic validation)
    const phoneRegex = /^[\d\s\+\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
        alert('Please enter a valid phone number');
        return;
    }

    if (accountRole === 'babysitter' && !location) {
        alert('Please enter your location');
        return;
    }

    try {
        const { data: existingUser } = await supabaseClient
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            alert('Email already registered');
            return;
        }

        const userData = {
            name: fullName,
            email: email,
            password: password,
            role: accountRole,
            address: address,
            postcode: postcode,
            phone: phone,
            created_at: new Date().toISOString()
        };

        if (accountRole === 'babysitter') {
            userData.location = location;
            userData.hourly_rate = 15;
            userData.bio = '';
            userData.years_experience = 0;
            userData.certified = false;
        }

        const { data, error } = await supabaseClient
            .from('users')
            .insert([userData])
            .select();

        if (error) {
            console.error('Signup error:', error);
            alert('Error: ' + error.message);
            return;
        }

        localStorage.setItem('currentUser', JSON.stringify(data[0]));
        alert('Account created successfully!');
        
        if (accountRole === 'babysitter') {
            window.location.href = 'babysitter-dashboard.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error('Exception during signup:', error);
        alert('Error: ' + error.message);
    }
}

function logoutUser() {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

// Babysitter Search
async function searchBabysitters() {
    try {
        let query = supabaseClient.from('users').select('*').eq('role', 'babysitter');
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value) {
            const searchTerm = searchInput.value.toLowerCase();
            query = query.or(`name.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`);
        }

        const rateFilter = document.getElementById('rateFilter');
        if (rateFilter && rateFilter.value) {
            const [min, max] = {
                'budget': [10, 15],
                'standard': [15, 20],
                'premium': [20, 999]
            }[rateFilter.value] || [0, 999];
            
            query = query.gte('hourly_rate', min).lte('hourly_rate', max);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Search error:', error);
            return;
        }

        const babysittersList = document.querySelector('.babysitters-list');
        if (!babysittersList) return;

        if (!data || data.length === 0) {
            babysittersList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No babysitters found</p>';
            return;
        }

        babysittersList.innerHTML = data.map(sitter => `
            <div class="babysitter-card">
                <div class="babysitter-avatar">${sitter.name.substring(0, 2).toUpperCase()}</div>
                <h3>${sitter.name}</h3>
                <p class="babysitter-location">${sitter.location || 'Location not specified'}</p>
                <div class="babysitter-rating">
                    <span id="rating-${sitter.id}">4.5</span> ★ (<span id="count-${sitter.id}">0</span> reviews)
                </div>
                <p class="babysitter-rate">£${sitter.hourly_rate}/hour</p>
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button class="btn-large" onclick="viewBabysitterProfile('${sitter.id}')" style="flex: 1;">View Profile</button>
                    <button class="fav-btn" data-sitter-id="${sitter.id}" onclick="toggleFavoriteBabysitter('${sitter.id}'); event.stopPropagation();" style="flex: 0.25; background: white; border: 2px solid var(--primary); color: var(--primary); padding: 10px; border-radius: 6px; font-size: 18px; cursor: pointer;">☆</button>
                </div>
            </div>
        `).join('');

        // Update favorite buttons state
        updateFavoriteButtons();

        // Load ratings for each babysitter
        data.forEach(sitter => loadBabysitterRating(sitter.id));
    } catch (error) {
        console.error('Exception during search:', error);
    }
}

async function loadBabysitterRating(babysitterId) {
    try {
        const { data } = await supabaseClient
            .from('reviews')
            .select('rating')
            .eq('babysitter_id', babysitterId);

        if (data && data.length > 0) {
            const average = (data.reduce((sum, r) => sum + r.rating, 0) / data.length).toFixed(1);
            const ratingEl = document.getElementById(`rating-${babysitterId}`);
            const countEl = document.getElementById(`count-${babysitterId}`);
            if (ratingEl) ratingEl.textContent = average;
            if (countEl) countEl.textContent = data.length;
        }
    } catch (error) {
        console.error('Error loading rating:', error);
    }
}

function viewBabysitterProfile(babysitterId) {
    window.location.href = `babysitter-profile.html?id=${babysitterId}`;
}

function sortBy(criteria) {
    // Sort implementation - could enhance with actual sorting
    searchBabysitters();
}

// Babysitter Profile Functions
async function loadBabysitterProfile(babysitterId) {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', babysitterId)
            .single();

        if (error || !data) {
            console.error('Profile load error:', error);
            return;
        }

        if (document.getElementById('profileTitle')) {
            document.getElementById('profileTitle').textContent = data.name;
            document.getElementById('profileAvatar').textContent = data.name.substring(0, 2).toUpperCase();
            document.getElementById('profileBio').textContent = data.bio || 'Professional babysitter with experience in childcare.';
            document.getElementById('profileLocation').textContent = data.location || 'Location not specified';
            document.getElementById('profileRate').textContent = '£' + (data.hourly_rate || 15) + '/hour';
            document.getElementById('profilePhone').textContent = data.phone || '--';
            document.getElementById('profilePostcode').textContent = data.postcode || '--';
            document.getElementById('profileAddress').textContent = data.address || '--';
            
            if (data.years_experience) {
                document.getElementById('profileExperience').textContent = data.years_experience + '+ years';
            }
        }

        // Load and display rating
        await loadBabysitterRating(babysitterId);

        return data;
    } catch (error) {
        console.error('Exception loading profile:', error);
    }
}

function toggleFavorite() {
    const favBtn = document.getElementById('favBtn');
    if (favBtn) {
        favBtn.textContent = favBtn.textContent === '☆' ? '★' : '☆';
    }
}

function quickMessage() {
    const params = new URLSearchParams(window.location.search);
    const babysitterId = params.get('id');
    if (babysitterId) {
        window.location.href = `messaging.html?recipientId=${babysitterId}`;
    }
}

// Booking Functions
function loadBookingInfo() {
    const selectedBabysitter = JSON.parse(localStorage.getItem('selectedBabysitter'));
    if (selectedBabysitter) {
        if (document.getElementById('bookingBabysitterName')) {
            document.getElementById('bookingBabysitterName').textContent = selectedBabysitter.name;
            document.getElementById('hourlyRate').textContent = selectedBabysitter.hourly_rate || 15;
        }
    }
}

function calculatePrice() {
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const hourlyRate = parseFloat(document.getElementById('hourlyRate').textContent);

    if (startTimeInput && endTimeInput && startTimeInput.value && endTimeInput.value) {
        const [startHours, startMins] = startTimeInput.value.split(':').map(Number);
        const [endHours, endMins] = endTimeInput.value.split(':').map(Number);
        
        const startMinutes = startHours * 60 + startMins;
        const endMinutes = endHours * 60 + endMins;
        
        const durationMinutes = endMinutes - startMinutes;
        const durationHours = durationMinutes / 60;
        
        if (durationHours > 0) {
            const totalPrice = (durationHours * hourlyRate).toFixed(2);
            const priceElement = document.querySelector('.total-price');
            if (priceElement) {
                priceElement.textContent = `Total: £${totalPrice}`;
            }
        }
    }
}

async function saveBooking() {
    const bookingDate = document.getElementById('bookingDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const childrenCount = document.getElementById('childrenCount').value;

    if (!bookingDate || !startTime || !endTime) {
        alert('Please fill in all required fields');
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        alert('Please login to make a booking');
        return;
    }

    const selectedBabysitter = JSON.parse(localStorage.getItem('selectedBabysitter'));
    const hourlyRate = parseFloat(document.getElementById('hourlyRate').textContent);

    const [startHours, startMins] = startTime.split(':').map(Number);
    const [endHours, endMins] = endTime.split(':').map(Number);
    
    const startMinutes = startHours * 60 + startMins;
    const endMinutes = endHours * 60 + endMins;
    const durationMinutes = endMinutes - startMinutes;
    const durationHours = durationMinutes / 60;
    const totalPrice = (durationHours * hourlyRate).toFixed(2);

    // Store booking data temporarily
    window.pendingBookingData = {
        babysitterId: selectedBabysitter.id,
        babysitterName: selectedBabysitter.name,
        bookingDate,
        startTime,
        endTime,
        childrenCount,
        totalPrice
    };

    // Show cancellation warning modal
    document.getElementById('modalTotalPrice').textContent = totalPrice;
    document.getElementById('modalFee50').textContent = (totalPrice * 0.5).toFixed(2);
    document.getElementById('modalFee100').textContent = totalPrice;
    document.getElementById('cancellationModal').classList.add('active');
}

async function proceedWithBooking() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const pendingData = window.pendingBookingData;

    if (!pendingData || !currentUser) return;

    try {
        const { data, error } = await supabaseClient
            .from('bookings')
            .insert([
                {
                    parent_id: currentUser.id,
                    babysitter_id: pendingData.babysitterId,
                    babysitter_name: pendingData.babysitterName,
                    booking_date: pendingData.bookingDate,
                    start_time: pendingData.startTime,
                    end_time: pendingData.endTime,
                    children_count: parseInt(pendingData.childrenCount),
                    total_price: parseFloat(pendingData.totalPrice),
                    status: 'confirmed',
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) {
            console.error('Booking error:', error);
            alert('Error: ' + error.message);
            return;
        }

        closeCancellationModal();
        alert('Booking confirmed! Check your dashboard.');
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error('Exception during booking:', error);
        alert('Error saving booking: ' + error.message);
    }
}

function closeCancellationModal() {
    const modal = document.getElementById('cancellationModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Dashboard Functions
async function loadDashboardBookings() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;

    try {
        const { data, error } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq('parent_id', currentUser.id)
            .order('booking_date', { ascending: false });

        if (error) {
            console.error('Error loading bookings:', error);
            return;
        }

        const bookingsList = document.querySelector('.bookings-list');
        if (!bookingsList) return;

        if (!data || data.length === 0) {
            bookingsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No bookings yet. <a href="parent-search.html" style="color: var(--primary); text-decoration: none; font-weight: 600;">Find a babysitter</a></p>';
            return;
        }

        bookingsList.innerHTML = data.map(booking => `
            <div class="booking-card" style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid var(--primary); margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h3 style="margin: 0 0 5px 0;">${booking.babysitter_name}</h3>
                        <p style="margin: 5px 0; color: var(--text-secondary);">${booking.booking_date} from ${booking.start_time} to ${booking.end_time}</p>
                        <p style="margin: 5px 0; color: var(--text-secondary);">Children: ${booking.children_count}</p>
                        <p style="margin: 5px 0; color: var(--primary); font-weight: 600;">£${booking.total_price}</p>
                    </div>
                    <div>
                        <span style="background: var(--success); color: white; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">${booking.status.toUpperCase()}</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Exception loading bookings:', error);
    }
}

// Messaging Functions
async function loadConversations() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;

    try {
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading conversations:', error);
            document.getElementById('conversationsList').innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">Error loading messages</p>';
            return;
        }

        if (!data || data.length === 0) {
            document.getElementById('conversationsList').innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No conversations yet</p>';
            return;
        }

        // Group by conversation partner
        const conversations = {};
        data.forEach(msg => {
            const partnerId = msg.sender_id === currentUser.id ? msg.recipient_id : msg.sender_id;
            const partnerName = msg.sender_id === currentUser.id ? msg.recipient_name : msg.sender_name;
            
            if (!conversations[partnerId]) {
                conversations[partnerId] = {
                    partnerId: partnerId,
                    partnerName: partnerName,
                    lastMessage: msg.message_text,
                    lastTime: msg.created_at
                };
            }
        });

        // Display conversations
        const conversationsList = document.getElementById('conversationsList');
        conversationsList.innerHTML = '';

        Object.values(conversations).forEach(conv => {
            const convEl = document.createElement('div');
            convEl.style.cssText = 'padding: 12px; border-bottom: 1px solid var(--neutral-border); cursor: pointer; transition: background 0.2s;';
            convEl.onmouseover = () => convEl.style.background = 'var(--neutral-light)';
            convEl.onmouseout = () => convEl.style.background = 'white';
            convEl.onclick = () => loadMessagesWithUser(conv.partnerId, conv.partnerName);
            convEl.innerHTML = `
                <p style="margin: 0; font-weight: 600; font-size: 14px;">${conv.partnerName}</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">${conv.lastMessage.substring(0, 40)}...</p>
            `;
            conversationsList.appendChild(convEl);
        });
    } catch (error) {
        console.error('Exception loading conversations:', error);
        document.getElementById('conversationsList').innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">Error loading messages</p>';
    }
}

async function loadMessagesWithUser(recipientId, recipientName) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;

    window.currentChatRecipientId = recipientId;
    window.currentChatRecipientName = recipientName;

    // Update header
    document.getElementById('messageHeader').innerHTML = `<h3 style="margin: 0;">${recipientName}</h3>`;

    // Enable message input FIRST
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus();

    // Allow sending with Enter key
    messageInput.onkeypress = function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    };

    try {
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error loading messages:', error);
            document.getElementById('messagesBox').innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">Error loading messages</p>';
            return;
        }

        const messagesBox = document.getElementById('messagesBox');
        if (!data || data.length === 0) {
            messagesBox.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No messages yet. Start the conversation!</p>';
        } else {
            messagesBox.innerHTML = (data || []).map(msg => `
                <div style="margin-bottom: 15px; text-align: ${msg.sender_id === currentUser.id ? 'right' : 'left'};">
                    <div style="display: inline-block; background: ${msg.sender_id === currentUser.id ? 'var(--primary)' : 'var(--neutral-light)'}; color: ${msg.sender_id === currentUser.id ? 'white' : 'inherit'}; padding: 10px 15px; border-radius: 8px; max-width: 70%; word-wrap: break-word;">
                        <p style="margin: 0;">${msg.message_text}</p>
                        <p style="margin: 5px 0 0 0; font-size: 11px; opacity: 0.7;">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                </div>
            `).join('');
        }

        // Scroll to bottom
        messagesBox.scrollTop = messagesBox.scrollHeight;
    } catch (error) {
        console.error('Exception loading messages:', error);
        document.getElementById('messagesBox').innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">Error loading messages</p>';
    }
}

async function sendMessage() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const recipientId = window.currentChatRecipientId;
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();

    if (!messageText) {
        messageInput.focus();
        return;
    }

    if (!currentUser || !recipientId) {
        alert('Error: Not connected to recipient');
        return;
    }

    // Disable send button to prevent double-send
    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = true;

    try {
        const { error } = await supabaseClient
            .from('messages')
            .insert([
                {
                    sender_id: currentUser.id,
                    sender_name: currentUser.name,
                    recipient_id: recipientId,
                    recipient_name: window.currentChatRecipientName,
                    message_text: messageText,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error('Error sending message:', error);
            alert('Error sending message: ' + error.message);
            sendButton.disabled = false;
            return;
        }

        messageInput.value = '';
        sendButton.disabled = false;
        messageInput.focus();
        
        // Reload messages
        await loadMessagesWithUser(recipientId, window.currentChatRecipientName);
        
        // Refresh conversation list
        loadConversations();
    } catch (error) {
        console.error('Exception sending message:', error);
        alert('Error: ' + error.message);
        sendButton.disabled = false;
    }
}

// Review Functions
async function loadBabysitterReviews(babysitterId) {
    try {
        const { data, error } = await supabaseClient
            .from('reviews')
            .select('*')
            .eq('babysitter_id', babysitterId)
            .eq('review_type', 'babysitter')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading reviews:', error);
            return;
        }

        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;

        if (!data || data.length === 0) {
            reviewsList.innerHTML = '<p>No reviews yet. Be the first to review!</p>';
            return;
        }

        reviewsList.innerHTML = data.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <h4>${review.reviewer_name}</h4>
                    <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
                </div>
                <p class="review-date">${new Date(review.created_at).toLocaleDateString()}</p>
                <p class="review-text">${review.review_text}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Exception loading reviews:', error);
    }
}

async function submitReview(babysitterId, isParentReview = false) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const reviewName = document.getElementById('reviewName')?.value;
    const reviewRating = document.getElementById('reviewRating')?.value;
    const reviewText = document.getElementById('reviewText')?.value;

    if (!reviewName || !reviewRating || !reviewText) {
        alert('Please fill in all fields');
        return;
    }

    if (!currentUser) {
        alert('Please login to submit a review');
        return;
    }

    try {
        const reviewData = {
            babysitter_id: babysitterId,
            reviewer_id: currentUser.id,
            reviewer_name: reviewName,
            rating: parseInt(reviewRating),
            review_text: reviewText,
            review_type: 'babysitter',
            created_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('reviews')
            .insert([reviewData]);

        if (error) {
            alert('Error: ' + error.message);
            return;
        }

        document.getElementById('reviewName').value = '';
        document.getElementById('reviewRating').value = '5';
        document.getElementById('reviewText').value = '';

        await loadBabysitterReviews(babysitterId);
        alert('Review submitted!');
    } catch (error) {
        alert('Error submitting review: ' + error.message);
    }
}

async function loadParentReviews(parentId) {
    try {
        const { data, error } = await supabaseClient
            .from('parent_reviews')
            .select('*')
            .eq('parent_id', parentId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading parent reviews:', error);
            return;
        }

        const reviewsList = document.getElementById('parentReviewsList');
        if (!reviewsList) return;

        if (!data || data.length === 0) {
            reviewsList.innerHTML = '<p>No reviews yet</p>';
            return;
        }

        reviewsList.innerHTML = data.map(review => `
            <div class="review-item">
                <div class="review-header">
                    <h4>${review.reviewer_name}</h4>
                    <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
                </div>
                <p class="review-date">${new Date(review.created_at).toLocaleDateString()}</p>
                <p class="review-text">${review.review_text}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Exception loading parent reviews:', error);
    }
}

async function submitParentReview(parentId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const reviewRating = document.getElementById('parentReviewRating')?.value;
    const reviewText = document.getElementById('parentReviewText')?.value;

    if (!reviewRating || !reviewText) {
        alert('Please fill in all fields');
        return;
    }

    if (!currentUser || currentUser.role !== 'babysitter') {
        alert('Only babysitters can review parents');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('parent_reviews')
            .insert([
                {
                    parent_id: parentId,
                    reviewer_id: currentUser.id,
                    reviewer_name: currentUser.name,
                    rating: parseInt(reviewRating),
                    review_text: reviewText,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) {
            alert('Error: ' + error.message);
            return;
        }

        document.getElementById('parentReviewRating').value = '5';
        document.getElementById('parentReviewText').value = '';

        await loadParentReviews(parentId);
        alert('Review submitted!');
    } catch (error) {
        alert('Error submitting review: ' + error.message);
    }
}

// Profile Update Functions
async function loadUserProfile() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error || !data) {
            console.error('Error loading profile:', error);
            return;
        }

        if (document.getElementById('profileName')) {
            document.getElementById('profileName').value = data.name || '';
            document.getElementById('profileEmail').value = data.email || '';
            document.getElementById('profileAddress').value = data.address || '';
            document.getElementById('profilePostcode').value = data.postcode || '';
            document.getElementById('profilePhone').value = data.phone || '';
            
            if (data.role === 'babysitter') {
                document.getElementById('babysitterFields').style.display = 'block';
                document.getElementById('profileLocation').value = data.location || '';
                document.getElementById('profileHourlyRate').value = data.hourly_rate || '';
                document.getElementById('profileBio').value = data.bio || '';
                document.getElementById('profileExperience').value = data.years_experience || '';
                document.getElementById('profileCertified').value = data.certified ? 'true' : 'false';
            }
        }
    } catch (error) {
        console.error('Exception loading profile:', error);
    }
}

async function updateUserProfile() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;

    const address = document.getElementById('profileAddress')?.value;
    const postcode = document.getElementById('profilePostcode')?.value;
    const phone = document.getElementById('profilePhone')?.value;

    // Validate required fields
    if (!address || !postcode || !phone) {
        alert('Address, postcode, and phone number are required');
        return;
    }

    // Validate UK postcode format
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    if (!postcodeRegex.test(postcode)) {
        document.getElementById('postcodeError').style.display = 'block';
        alert('Please enter a valid UK postcode (e.g., SW1A 1AA)');
        return;
    }

    // Validate phone number
    const phoneRegex = /^[\d\s\+\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
        alert('Please enter a valid phone number');
        return;
    }

    const updateData = {
        name: document.getElementById('profileName')?.value,
        email: document.getElementById('profileEmail')?.value,
        address: address,
        postcode: postcode,
        phone: phone
    };

    if (currentUser.role === 'babysitter') {
        updateData.location = document.getElementById('profileLocation')?.value;
        updateData.hourly_rate = parseFloat(document.getElementById('profileHourlyRate')?.value);
        updateData.bio = document.getElementById('profileBio')?.value;
        updateData.years_experience = parseInt(document.getElementById('profileExperience')?.value) || 0;
        // Only add certified if the field exists
        const certifiedField = document.getElementById('profileCertified');
        if (certifiedField) {
            updateData.certified = certifiedField.value === 'true';
        }
    }

    try {
        const { error } = await supabaseClient
            .from('users')
            .update(updateData)
            .eq('id', currentUser.id);

        if (error) {
            console.error('Update error:', error);
            alert('Error: ' + error.message);
            return;
        }

        // Update localStorage
        const updatedUser = { ...currentUser, ...updateData };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));

        alert('Profile updated successfully!');
    } catch (error) {
        console.error('Exception updating profile:', error);
        alert('Error updating profile: ' + error.message);
    }
}
