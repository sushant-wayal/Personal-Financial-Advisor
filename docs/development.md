# Development Guide — North Personal Financial Advisor

## Prerequisites

- **Node.js**: v20 or higher (Active LTS)
- **Package Manager**: `npm` (v10+)
- **Database**: PostgreSQL 15+ (local or hosted e.g. Neon, Supabase)
- **Mobile Development** (Optional): Expo CLI (`npx expo`), Android Studio / Xcode for emulators or Expo Go app on a physical device.

---

## Getting Started

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd Personal-Financial-Advisor

# Install web dependencies
npm install

# Install mobile dependencies
cd mobile
npm install
cd ..
```

### 2. Environment Configuration

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

Ensure `DATABASE_URL` points to your PostgreSQL instance.

### 3. Database Migration & Prisma Generation

```bash
npm run prisma:generate
npm run prisma:deploy
```

### 4. Running the Development Servers

#### Web Application:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Mobile Application:
```bash
cd mobile
npx expo start
```
Scan the QR code with Expo Go or run on an emulator (`a` for Android, `i` for iOS).

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Next.js development server on port 3000 |
| `npm run build` | Runs database migrations and compiles Next.js for production |
| `npm run lint` | Runs ESLint across the repository (strict: 0 errors & 0 warnings) |
| `npm run test` | Runs unit and domain tests via Vitest |
| `npm run test:watch` | Runs Vitest in watch mode |
| `npm run test:coverage` | Generates Vitest code coverage report |
| `npm run prisma:generate` | Generates Prisma Client from schema |
| `npm run prisma:deploy` | Applies pending Prisma migrations to the database |
| `npm run prisma:studio` | Opens visual Prisma Studio database GUI |
| `npm run check-api-base-url` | Verifies mobile API base URL matches production before commits |

---

## Coding Standards & Quality Gates

1. **Strict TypeScript**: Both `npx tsc --noEmit` (web) and `npx tsc --project mobile/tsconfig.json --noEmit` (mobile) must pass with 0 errors.
2. **Zero-Tolerance Linting**: `npm run lint` must produce 0 errors and 0 warnings.
3. **Dual-Platform Implementation**: Any user-facing feature must be added to both Web (`app/`) and Mobile (`mobile/src/app/`).
4. **Financial Safety**: Monetary calculations must never use floating-point shortcuts without explicit rounding and clamping.

