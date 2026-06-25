// netlify/functions/google-calendar-auth.js
// This function securely exchanges Google OAuth authorization code for access token
// Place this file in: netlify/functions/google-calendar-auth.js

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse request body
        let requestBody;
        try {
            requestBody = JSON.parse(event.body);
        } catch {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }

        const { code, userId, redirectUri } = requestBody;

        if (!code || !userId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing code or userId' })
            };
        }

        // Get environment variables
        const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            console.error('Missing Google OAuth credentials in environment variables');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
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
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: tokenData.error_description || 'Failed to exchange authorization code'
                })
            };
        }

        if (!tokenData.access_token) {
            console.error('No access token in response:', tokenData);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No access token received from Google' })
            };
        }

        console.log(`Successfully exchanged code for user ${userId}`);

        // Return access token to frontend
        // Frontend will save this to Supabase
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || null,
                expiresIn: tokenData.expires_in || 3600,
                tokenType: tokenData.token_type || 'Bearer'
            })
        };

    } catch (error) {
        console.error('Error in google-calendar-auth function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Internal server error: ' + error.message 
            })
        };
    }
};