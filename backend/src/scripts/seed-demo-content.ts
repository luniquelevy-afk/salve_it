// Charge le contenu de démonstration (idempotent). Refusé en production.
// Usage : pnpm --filter @salve/backend db:seed   (après db:migrate)
import { seedDemoContent } from '../migrations/demo-content.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refus : le contenu de démonstration ne doit jamais être chargé en production.');
  process.exit(1);
}

console.log(await seedDemoContent());
process.exit(0);
