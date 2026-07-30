# BookFlow 🌱 | Multi-Tenant Booking & Scheduling System

BookFlow is a multi-tenant booking platform built with an **Express/TypeScript backend** and a **Vite/React frontend** styled with a custom vanilla white-and-green design system.

It features role-based access control, tenant data isolation using a shared schema strategy, a real-time calendar availability engine, and simulated subscription tier guards.

---

## 🚀 Quick Start (Docker Compose)

The easiest way to spin up the entire stack (PostgreSQL database, Node.js API, and Nginx Client) is using Docker Compose:

1. Make sure **Docker** and **Docker Compose** are installed and running.
2. In the root directory, run:
   ```bash
   docker-compose up --build
   ```
3. Docker will compile and initialize:
   - **PostgreSQL Database** on port `5432`
   - **Express API Backend** on port `5000`
   - **React Web Client** on port `8080`
4. Access the web interface in your browser: [http://localhost:8080](http://localhost:8080)

---

## 🔑 Seeded Demo Accounts

The database is pre-seeded with sample credentials for rapid testing of different user roles and subscription tiers:

| Email | Password | Role | Business Affiliate (Tenant) | Subscription Plan |
| :--- | :--- | :--- | :--- | :--- |
| `admin@bookflow.com` | `admin123` | `PLATFORM_ADMIN` | Global Platform | N/A |
| `owner@greengarden.com` | `provider123` | `PROVIDER_ADMIN` | Green Garden Salon | **Professional** |
| `owner@ecocuts.com` | `provider123` | `PROVIDER_ADMIN` | Eco Cuts Barbershop | **Free** |
| `clara@greengarden.com` | `staff123` | `STAFF` | Green Garden Salon | **Professional** |
| `customer@gmail.com` | `customer123` | `CUSTOMER` | Client | N/A |

---

## 🛠️ Local Development Setup (Manual)

To run the client and API separately without Docker:

### 1. Database Configuration
Run a local PostgreSQL instance and set your connection URI in `backend/.env`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/bookflow?schema=public"
JWT_SECRET="your-development-jwt-secret-key"
```

### 2. Set Up API Backend
Navigate to the `backend/` directory:
```bash
cd backend
# Install dependencies
npm install
# Generate Prisma models and schema client
npx prisma generate
# Push schema structure to Database and seed data
npx prisma db push
npx prisma db seed
# Run local dev server (port 5000)
npm run dev
```

### 3. Set Up React Frontend
Navigate to the `frontend/` directory:
```bash
cd ../frontend
# Install dependencies
npm install
# Run local dev server (port 5173 - requests automatically proxy to port 5000)
npm run dev
```

---

## 📋 API Route Specifications

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | Register a new customer | None |
| **POST** | `/api/auth/login` | Login user, returns signed JWT | None |
| **GET** | `/api/auth/me` | Fetch active session profiles | Any Role |
| **GET** | `/api/providers` | List all verified business profiles | None |
| **POST** | `/api/providers/onboard` | Onboard a new business merchant + owner | None |
| **GET** | `/api/providers/profile/:slug` | Fetch services and staff details for a provider | None |
| **POST** | `/api/providers/staff/create` | Add staff member (enforces subscription limits) | `PROVIDER_ADMIN` |
| **POST** | `/api/providers/services/create` | Add service (enforces subscription limits) | `PROVIDER_ADMIN` |
| **PUT** | `/api/providers/staff/:id/schedule` | Edit staff calendar schedule template | `PROVIDER_ADMIN` |
| **POST** | `/api/providers/staff/:id/exception` | Add calendar exceptions (vacation/time off) | `PROVIDER_ADMIN` |
| **PUT** | `/api/providers/subscription` | Upgrade/change business subscription plan | `PROVIDER_ADMIN` |
| **GET** | `/api/bookings/availability` | Fetch available slots for service, staff, date | None |
| **POST** | `/api/bookings/create` | Secure checkout appointment with mock card payment | `CUSTOMER` |
| **GET** | `/api/bookings` | View history of client or staff bookings | Any Role |
| **PUT** | `/api/bookings/:id/cancel` | Cancel an upcoming booking appointment | `CUSTOMER` / `PROVIDER_ADMIN` |
| **GET** | `/api/admin/dashboard` | Fetch global platform analytics + audit logs | `PLATFORM_ADMIN` |
| **GET** | `/api/admin/provider/dashboard` | Fetch merchant-specific booking metrics | `PROVIDER_ADMIN` / `STAFF` |

---

## 🔒 Security Architectures
- **Role-Based Access Control**: Middleware guards evaluate user roles to restrict endpoints.
- **Tenant Isolation**: Database queries always filter scope using `tenantId` resolved from user session credentials, preventing multi-tenant data leakages.
- **Gateway Simulation**: Financial card numbers are never sent or stored raw; client tokenizes credentials into mock gateways (Stripe Connect splits) which computes platform fee splits during booking transaction events.
- **Input Validation**: Request structures are validated at the router interface using strict Zod structures to block code injection.
- **Auditing**: Log entities write critical events (subscription updates, logins, registrations) into the DB audit trail.
