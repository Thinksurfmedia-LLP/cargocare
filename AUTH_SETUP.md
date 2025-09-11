# Cargo Care - Authentication System

A modern cargo management system built with React Router v7, Prisma, and PostgreSQL.

## Features

✅ **User Authentication System**
- Login/Signup pages with shadcn/ui components
- Role-based access control (ADMIN, LINER_BOOKING_TEAM, SHIPMENT_PLAN_TEAM, INACTIVE)
- Secure password hashing with bcrypt
- Session management with Remix Auth
- New users start with INACTIVE status

✅ **User Roles**
- **ADMIN**: Full system access and user management
- **LINER_BOOKING_TEAM**: Manage liner bookings and schedules  
- **SHIPMENT_PLAN_TEAM**: Handle shipment planning and logistics
- **INACTIVE**: Newly registered users pending activation
- **MD**: Shipping Plan and booking approvals

✅ **Security Features**
- Password hashing with bcrypt (12 rounds)
- Secure session management
- Protected routes
- CSRF protection
- Password reset functionality (schema ready)
- Email verification system (schema ready)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and update the values:
```bash
cp .env.example .env
```

Update your `.env` file:
```env
DATABASE_URL="your-postgresql-connection-string"
SESSION_SECRET="your-super-secret-session-key-32-chars-minimum"
NODE_ENV="development"
```

### 3. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed initial data (creates roles and admin user)
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` - you'll be redirected to login.

## Default Admin Account

After seeding, you can login with:
- **Email**: `admin@cargocare.com`
- **Password**: `admin123`

⚠️ **Change this password in production!**

## Project Structure

```
app/
├── components/ui/          # shadcn/ui components
├── lib/                    # Utilities
│   ├── auth.server.ts     # Authentication logic
│   ├── prisma.server.ts   # Database client
│   ├── session.server.ts  # Session management
│   └── utils.ts           # Utility functions
├── routes/                 # Application routes
│   ├── dashboard.tsx      # Protected dashboard
│   ├── login.tsx          # Login page
│   ├── signup.tsx         # Registration page
│   ├── logout.tsx         # Logout action
│   └── home.tsx           # Root redirect
└── generated/prisma/       # Generated Prisma client

prisma/
├── schema.prisma          # Database schema
├── seed.ts               # Database seeding
└── migrations/           # Database migrations
```

## User Registration Flow

1. **New User Signs Up** → Created with `INACTIVE` role
2. **Admin Reviews** → Changes role to appropriate team role
3. **User Can Login** → Access granted based on role

## API Scripts

```bash
# Database
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Run database migrations  
npm run db:seed         # Seed initial data
npm run db:studio       # Open Prisma Studio

# Development
npm run dev             # Start dev server
npm run build           # Build for production
npm run start           # Start production server
npm run typecheck       # Type checking
```

## Role-Based Access Control

Each role has different capabilities in the dashboard:

### ADMIN
- Manage user accounts and permissions
- Configure system settings
- View all bookings and shipments
- Generate reports and analytics
- Activate/deactivate user accounts

### LINER_BOOKING_TEAM  
- Create and manage liner bookings
- View shipping schedules
- Coordinate with customers
- Track booking status

### SHIPMENT_PLAN_TEAM
- Plan and optimize shipment routes
- Manage cargo allocation
- Track shipment progress
- Coordinate logistics operations

### INACTIVE
- Limited access
- Account pending activation
- Contact administrator message

### MD
- Limited access
- Shipping Plan Approval

## Technology Stack

- **Frontend**: React Router v7, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui
- **Backend**: React Router (SSR)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Remix Auth with Form Strategy
- **Security**: bcrypt, secure sessions, CSRF protection

## Security Best Practices

- ✅ Passwords hashed with bcrypt (12 rounds)
- ✅ Secure session cookies (httpOnly, secure, sameSite)
- ✅ Environment variables for secrets
- ✅ Input validation and sanitization
- ✅ Protected routes with authentication
- ✅ Role-based authorization
- ✅ Password complexity requirements

## Development

The application uses React Router v7 with SSR enabled. The authentication system is built with Remix Auth for seamless integration.

### Key Files:
- `app/lib/auth.server.ts` - Authentication logic and helpers
- `app/routes/login.tsx` - Login page with form handling
- `app/routes/signup.tsx` - Registration with INACTIVE role assignment
- `app/routes/dashboard.tsx` - Protected dashboard with role-specific content
- `prisma/schema.prisma` - Database schema with User/Role models

## Production Deployment

1. Update environment variables
2. Set `NODE_ENV=production`
3. Update `SESSION_SECRET` to a secure value
4. Configure your PostgreSQL database
5. Run migrations: `npm run db:migrate`
6. Build: `npm run build`
7. Start: `npm start`

## Contributing

1. Follow TypeScript strict mode
2. Use shadcn/ui components for consistency
3. Add proper error handling
4. Include loading states
5. Test authentication flows

---

**Status**: ✅ Authentication system fully implemented and tested
**Next Steps**: Add admin user management, booking system, and shipment tracking
