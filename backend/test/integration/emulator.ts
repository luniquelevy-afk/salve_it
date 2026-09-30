// Outils communs : remise à zéro des émulateurs entre les suites.
const PROJECT = 'demo-salve-italia';

// Quelques nouvelles tentatives : un émulateur local très sollicité peut refuser ponctuellement une connexion.
async function deleteWithRetry(url: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { method: 'DELETE' });
      if (response.ok) return;
      throw new Error(`${response.status} ${url}`);
    } catch (error) {
      if (attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

export async function resetEmulators(): Promise<void> {
  await deleteWithRetry(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`);
  await deleteWithRetry(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`);
}

// Connexion e-mail / mot de passe via l'API REST de l'émulateur Auth → jeton d'identité.
export async function signIn(email: string, password: string): Promise<string> {
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) },
  );
  const body = (await response.json()) as { idToken?: string; error?: { message: string } };
  if (!body.idToken) throw new Error(`Connexion impossible : ${body.error?.message ?? response.status}`);
  return body.idToken;
}
