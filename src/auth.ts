import admin from 'firebase-admin'

let isInitialized = false

const getAuth = () => {
  if (isInitialized) return admin.auth()

  // Deployment CLIs can preserve a trailing newline when reading secrets from
  // standard input. Trim identifier fields before creating the Admin app.
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
      isInitialized = true
      console.log('Firebase Admin SDK initialized successfully.')
      return admin.auth()
    } catch (err: any) {
      console.error('Failed to initialize Firebase Admin SDK:', err.message)
    }
  }

  return null
}

export type DecodedUser = {
  uid: string
  email: string | null
}

export const verifyFirebaseToken = async (
  token: string
): Promise<DecodedUser | null> => {
  const auth = getAuth()
  if (!auth) {
    // Mock mode for local testing if token starts with "mock_".
    if (token.startsWith('mock_')) {
      const parts = token.split('_')
      return {
        uid: parts[1] || 'mock_user_123',
        email: parts[2] ? decodeURIComponent(parts[2]) : 'mock@example.com'
      }
    }
    return null
  }

  try {
    const decodedToken = await auth.verifyIdToken(token)
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || null
    }
  } catch (error: any) {
    console.error('Error verifying Firebase token:', error.message)
    return null
  }
}
