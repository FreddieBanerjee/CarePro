let map;

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize map centered on UK
    map = L.map('map-container').setView([51.5074, -0.1278], 6);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Fetch and display babysitters
    loadBabysittersOnMap();
});

async function loadBabysittersOnMap() {
    try {
        const { data: babysitters, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('role', 'babysitter');
        
        if (error) throw error;
        
        babysitters.forEach(sitter => {
            if (sitter.latitude && sitter.longitude) {
                const marker = L.marker([sitter.latitude, sitter.longitude]).addTo(map);
                marker.bindPopup(`
                    <div style="width: 200px;">
                        <h3 style="margin: 0 0 8px 0;">${sitter.name}</h3>
                        <p style="margin: 0 0 8px 0; font-size: 14px;">£${sitter.hourly_rate}/hour</p>
                        <button onclick="window.location.href='babysitter-profile.html?id=${sitter.id}'" style="width: 100%; padding: 8px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer;">View Profile</button>
                    </div>
                `);
            }
        });
    } catch (error) {
        console.error('Error loading babysitters:', error);
    }
}
