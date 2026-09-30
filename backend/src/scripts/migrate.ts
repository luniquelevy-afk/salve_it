// Applique les migrations Firestore en attente (équivalent de « supabase db push »).
// Usage : pnpm --filter @salve/backend db:migrate
import { MIGRATIONS, runMigrations } from '../migrations/index.js';

const ran = await runMigrations();
console.log(ran.length === 0 ? `Base à jour (${MIGRATIONS.length} migrations appliquées).` : `${ran.length} migration(s) appliquée(s).`);
process.exit(0);
