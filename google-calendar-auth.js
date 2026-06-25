// api/google-calendar-auth.js
// Vercel Serverless Function - Google Calendar OAuth Token Exchange

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse request body
    const { code, userId, redirectUri } = req.body;

    if (!code || !userId) {
      return res.status(400).json({ error: 'Missing code or userId' });
    }

    // Get environment variables
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('Missing Google OAuth credentials in environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri || 'http://localhost:3000/google-calendar-callback.html',
        grant_type: 'authorization_code'
      }).toString()
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Google token exchange error:', tokenData);
      return res.status(400).json({ 
        error: tokenData.error_description || 'Failed to exchange authorization code'
      });
    }

    if (!tokenData.access_token) {
      console.error('No access token in response:', tokenData);
      return res.status(400).json({ error: 'No access token received from Google' });
    }

    console.log(`Successfully exchanged code for user ${userId}`);

    // Return access token to frontend
    return res.status(200).json({
      success: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresIn: tokenData.expires_in || 3600,
      tokenType: tokenData.token_type || 'Bearer'
    });

  } catch (error) {
    console.error('Error in google-calendar-auth function:', error);
    return res.status(500).json({ 
      error: 'Internal server error: ' + error.message 
    });
  }
}
