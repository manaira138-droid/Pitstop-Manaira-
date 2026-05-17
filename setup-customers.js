const { getDb } = require('./src/db');

async function main() {
  const db = await getDb();

  await db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(30) UNIQUE NOT NULL,
      email VARCHAR(150) UNIQUE,
      password_hash TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id)
  `);

  console.log('Tabela customers criada e orders atualizada com sucesso.');
}

main()
  .catch((err) => {
    console.error('Erro ao executar setup:', err);
  })
  .finally(() => {
    process.exit();
  });
  