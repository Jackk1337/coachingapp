import { NextRequest } from 'next/server';
import { getAdminAuth } from './firebase-admin';

/**
 * Verifies the Firebase ID token from the Authorization header and returns the user ID.
 * Throws an error if authentication fails.
 * 
 * @param request - The Next.js request object
 * @returns The authenticated user's UID
 * @throws Error if authentication fails
 */
export async function verifyAuth(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid authorization header');
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  if (!idToken) {
    throw new Error('Unauthorized: Missing token');
  }
  
  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    // Log the error for debugging but don't expose details to client
    console.error('Token verification failed:', error);
    throw new Error('Unauthorized: Invalid token');
  }
}

