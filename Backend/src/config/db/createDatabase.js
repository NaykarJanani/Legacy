import fs from "fs";
import path from "path";
import pool from "./db_config.js";
import RefParser from "json-schema-ref-parser";

const schemaPath = path.resolve("src/config/db/index.json");

async function createOrUpdateTables() {
  try {
    // Load and dereference schema
    const schema = await RefParser.dereference(schemaPath);

    // ✅ Trigger function
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    for (const table of schema) {
      const { table_name, fields, constraints = [] } = table;

      const columns = fields.map(f => `${f.name} ${f.type}`).join(", ");
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${table_name} (
          ${columns}
        );
      `;
      console.log(`🛠 Creating table: ${table_name}`);
      await pool.query(createTableQuery);

      // Check exists
      const tableCheck = await pool.query(
        `SELECT to_regclass('${table_name}') as exists;`
      );
      if (!tableCheck.rows[0].exists) {
        console.error(`❌ Failed to create table: ${table_name}, skipping...`);
        continue;
      }

      // Add missing columns
      for (const field of fields) {
        await pool.query(`
          ALTER TABLE ${table_name}
          ADD COLUMN IF NOT EXISTS ${field.name} ${field.type};
        `);
      }

      // Update existing column types if they changed
for (const field of fields) {
  const upperType = field.type.toUpperCase();

  // Skip primary keys, serials and unique columns
  if (
    upperType.includes("SERIAL") ||
    upperType.includes("PRIMARY KEY") ||
    upperType.includes("UNIQUE")
  ) {
    continue;
  }

  try {
    const baseType = field.type
      .replace(/NOT NULL/gi, "")
      .replace(/DEFAULT.*$/gi, "")
      .replace(/UNIQUE/gi, "")
      .trim();

    await pool.query(`
      ALTER TABLE ${table_name}
      ALTER COLUMN ${field.name}
      TYPE ${baseType}
      USING ${field.name}::${baseType};
    `);
  } catch (err) {
    console.log(
      `ℹ️ Skipped type update for ${table_name}.${field.name}: ${err.message}`
    );
  }
}

      // Add table-level constraints (e.g. "UNIQUE (editor_id, user_id)")
      // declared in the schema's "constraints" array. These were previously
      // silently ignored — CREATE TABLE IF NOT EXISTS only ever saw `columns`.
      for (let i = 0; i < constraints.length; i++) {
        const constraintName = `${table_name}_constraint_${i}`;
        try {
          await pool.query(`
            ALTER TABLE ${table_name}
            ADD CONSTRAINT ${constraintName} ${constraints[i]};
          `);
          console.log(`✅ Added constraint ${constraintName} on ${table_name}`);
        } catch (err) {
          // Already exists on a rerun, or blocked by existing duplicate data —
          // log and continue rather than aborting the whole sync.
          console.log(`ℹ️ Skipped constraint ${constraintName} on ${table_name}: ${err.message}`);
        }
      }

      // Add trigger
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_${table_name}'
          ) THEN
            CREATE TRIGGER set_updated_at_${table_name}
            BEFORE UPDATE ON ${table_name}
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
          END IF;
        END
        $$;
      `);

      console.log(`✅ Table ${table_name} is up to date`);
    }

    console.log("✅ Database schema sync complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error syncing schema:", err);
    process.exit(1);
  }
}

createOrUpdateTables();