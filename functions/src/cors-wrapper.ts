import { onRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// Helper to wrap callable functions as HTTP functions with proper CORS
export const corsWrapper = (handler: (data: any, auth: any) => Promise<any>) => {
  return onRequest({ cors: true, region: 'us-central1' }, async (req, res) => {
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Max-Age', '86400');
      res.status(204).send('');
      return;
    }

    // Set CORS headers for main request
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      // Verify Firebase auth token
      let auth = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        try {
          auth = await admin.auth().verifyIdToken(idToken);
        } catch (error) {
          res.status(401).json({ error: { message: 'Unauthorized', code: 'unauthenticated' } });
          return;
        }
      }

      // Call the actual handler
      const { data } = req.body;
      const result = await handler(data || {}, auth);

      res.status(200).json({ result });
    } catch (error: any) {
      if (error instanceof HttpsError) {
        res.status(400).json({ error: { message: error.message, code: error.code } });
      } else {
        console.error('Function error:', error);
        res.status(500).json({ error: { message: 'Internal server error', code: 'internal' } });
      }
    }
  });
};