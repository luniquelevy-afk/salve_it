// Réponse 429 au même format que les autres erreurs de l'API (le client affiche `message`).
export const RATE_LIMIT_MESSAGE = {
  error: { code: 'rate_limited', message: 'Trop de requêtes en peu de temps. Patientez un instant puis réessayez.' },
};
