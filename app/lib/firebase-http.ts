import { getAuth } from 'firebase/auth';

const FUNCTIONS_URL = 'https://us-central1-among-us-irl-86233.cloudfunctions.net';

export async function callHttpFunction<T = any, R = any>(name: string, data: T): Promise<R> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Not authenticated');
  }

  const idToken = await user.getIdToken();

  const response = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Function call failed');
  }

  const result = await response.json();
  return result.result;
}