# 1. Extract ZIP, enter project
cd bos

# 2. Copy and fill environment variables
cp .env.example .env.local
# Fill in: DATABASE_URL, DIRECT_URL (from Neon), JWT_SECRET (random 64-char hex)
# SUPER_ADMIN_PASSWORD (something strong)

# 3. Install dependencies
npm install

# 4. Run migration (creates all tables in Neon)
npm run db:migrate

# 5. Seed the database
npm run db:seed

# 6. Verify the stack
npm run dev
# Open: http://localhost:3000/api/health
# Expected: { "status": "ok", "checks": { "database": true, "jwt_secret": true } }