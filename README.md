# Event Growth Platform (Ripple) 🌊🚀

A full-stack, viral event growth platform designed for campus events, college festivals, and student communities. Ripple features gamified referral systems, dynamic college & club leaderboards, viral loops, attendee tickets, and real-time administrative analytics.

---

## ⚡ Live Deployment

- **Production URL**: [http://16.192.244.119:4000](http://16.192.244.119:4000)
- **Host**: AWS EC2 (Ubuntu 24.04 / 26.04)
- **CI/CD**: Automated GitHub Actions with zero-downtime Docker Compose rolling replacements.

---

## 🛠️ Architecture & Tech Stack

### Monorepo Structure
```text
Event-Growth-Platform-Ripple/
├── client/                 # React 19 + Vite + Tailwind CSS v4 frontend
│   ├── src/pages/          # Landing, Registration, Leaderboard, Ticket, Admin Analytics
│   └── src/components/     # Reusable UI & Recharts visualizations
├── server/                 # Node.js + Express + TypeScript API
│   ├── src/db/             # Drizzle ORM schemas, relations & seed data
│   ├── src/routes/         # Events, colleges, registrations, admin endpoints
│   └── src/utils/          # In-memory caching, email dispatchers (Resend)
├── docker-compose.yml      # Local dev environment (PostgreSQL 16)
├── docker-compose.prod.yml # Production multi-container setup
├── Dockerfile              # Multi-stage production container build
└── .github/workflows/      # Automated CI/CD deployment pipeline
```

### Technology Highlights
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, React Router v7.
- **Backend**: Node.js 22, Express, TypeScript, Drizzle ORM, Zod, Cookie-Parser, Resend API.
- **Database**: PostgreSQL 16 (with automated migrations via Drizzle Kit).
- **Containerization**: Multi-stage Docker builds with non-root security (`dumb-init`, alpine).
- **Cloud Infrastructure**: AWS EC2, Elastic IP, GitHub Actions SSH deployment runner.

---

## 🚀 Key Features

- **Viral Referral Engine**: Automatic unique referral code generation per attendee; tracks 1st-degree and viral propagation loops.
- **Live Leaderboards**: Cached, sub-millisecond ranking for Colleges, Student Clubs, and Individual Referral Champions.
- **Real-Time Analytics Dashboard**: Administrative KPI monitoring including K-Factor (Viral Multiplier), daily registration velocity, branch/semester breakdown, and referral attribution channels.
- **Digital Attendee Ticket**: Dynamic ticket generation with verification badges and referral link shortcuts.
- **Email Confirmation**: Transactional email dispatch powered by Resend (with graceful local fallback).

---

## 💻 Local Development Setup

### 1. Prerequisites
- Node.js (v20+)
- npm (v10+)
- Docker & Docker Compose

### 2. Clone Repository
```bash
git clone https://github.com/itsXILO/Event-Growth-Platform-Ripple.git
cd Event-Growth-Platform-Ripple
```

### 3. Start Local PostgreSQL Database
```bash
docker compose up -d
```

### 4. Install Dependencies
```bash
npm install
npm install --prefix server
npm install --prefix client
```

### 5. Setup Environment Variables
```bash
cp .env.example .env
```
Ensure `.env` contains:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://ripple:ripple_secret@localhost:5432/ripple_db
ADMIN_PASSWORD=admin123
VITE_API_URL=http://localhost:4000
```

### 6. Run Migrations & Seed Sample Data
```bash
npm run db:migrate
npm run db:seed
```

### 7. Start Concurrent Development Server
```bash
npm run dev
```
- Client runs at: `http://localhost:5173`
- Backend API runs at: `http://localhost:4000`

---

## 🚢 Docker & Production Deployment

### Manual Local Docker Build
```bash
# Build multi-stage image
docker build -t ripple:latest .

# Run production stack locally
docker compose -f docker-compose.prod.yml up -d
```

### Continuous Deployment (CI/CD via GitHub Actions)
Every push to the `main` branch triggers `.github/workflows/deploy.yml`:
1. **Build & Push**: Builds the unified multi-stage container and publishes to Docker Hub (`${DOCKERHUB_USERNAME}/ripple:latest`).
2. **Deploy via SSH**: Securely connects to the AWS EC2 instance, runs `docker compose pull`, updates the stack with `docker compose up -d`, executes Drizzle migrations, and purges dangling images.

#### Required GitHub Secrets:
| Secret | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token |
| `EC2_HOST` | Target AWS Elastic IP (`16.192.244.119`) |
| `EC2_USER` | EC2 SSH username (`ubuntu`) |
| `EC2_SSH_KEY` | Private SSH key contents (`.pem`) |

---

## 🔒 Security Best Practices
- **Non-root container execution**: Runs under user `node` in production.
- **Process management**: Handled by `dumb-init` to ensure graceful PID 1 signal termination.
- **Network isolation**: PostgreSQL is bound strictly to the private bridge network; external access is blocked by default.
- **Environment protection**: Sensitive keys are loaded exclusively through Docker environment files.

---

## 📄 License
This project is licensed under the MIT License.
