// Tohum verisi: gerçek gönüllüler gelene kadar demo için. Gerçek veriyle karışmasın diye
// her kayıt `seed:` önekli e-posta taşır ve ayrı bir komutla silinebilir.
import { createDb, users } from './index';

const db = createDb();
await db
  .insert(users)
  .values([{ email: 'seed:operator@evidex.local', name: 'GİRVAK Operatör', role: 'operator' }])
  .onConflictDoNothing();
console.log('seed ok');
process.exit(0);
