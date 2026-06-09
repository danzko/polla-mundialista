import fs from "fs";
import path from "path";
import postgres from "postgres";

// Manually parse .env.local to ensure environment variables are loaded
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    console.log("Loading .env.local...");
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim().replace(/^['"]|['"]$/g, "");
        process.env[key] = val;
      }
    }
  } else {
    console.warn(".env.local file not found. Relying on system env vars.");
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ Error: DATABASE_URL is not set in .env.local or environment.");
  process.exit(1);
}

async function runMigration() {
  console.log("Connecting to database...");
  // Connect to postgres (use SSL connection if required, default is auto)
  const sql = postgres(DATABASE_URL, {
    ssl: { rejectUnauthorized: false }, // Useful for AWS/Supabase hosted connections
    max: 1
  });

  try {
    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "0001_initial_schema.sql");
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found at: ${migrationPath}`);
    }

    console.log("Reading schema migration SQL file...");
    const rawSql = fs.readFileSync(migrationPath, "utf8");

    console.log("Running migration SQL script in a transaction...");
    // Run the migration as a single transaction
    await sql.begin(async (tx) => {
      // postgres-js executes raw SQL by passing a string, but it's safer to execute it directly.
      // We can use unsafe to run raw, arbitrary multi-statement SQL strings.
      await tx.unsafe(rawSql);
    });

    console.log("✅ Migration successfully applied!");
  } catch (error) {
    console.error("❌ Migration failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
