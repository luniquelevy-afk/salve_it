import { firestore } from '../firebase.js';
import { QueryBuilder } from './query.js';

export { DbError } from './types.js';

// Point d'accès unique aux données (Firestore via le SDK Admin).
export const db = {
  from: (table: string) => new QueryBuilder(firestore, table),
};
