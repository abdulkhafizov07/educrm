# EduCRM Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+ (local or cloud)

## 1. Install PostgreSQL

**Windows:** Download from https://www.postgresql.org/download/windows/
After install, PostgreSQL runs on port 5432 by default.

**Or use a cloud service:**  
- Supabase (free): https://supabase.com  
- Railway: https://railway.app  
- Neon: https://neon.tech  

## 2. Configure Environment

Copy `.env.example` to `.env` and update:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=educrm
DB_USER=postgres
DB_PASSWORD=your_postgres_password

JWT_SECRET=change-this-to-a-random-secret-key
JWT_REFRESH_SECRET=change-this-to-another-random-secret-key
```

## 3. Create Database

Using psql:
```bash
psql -U postgres -c "CREATE DATABASE educrm;"
```

## 4. Initialize Database

```bash
npm run db:init
```

This creates all tables and a default super admin:
- Username: `superadmin`
- Password: `Admin@123`

**Change this password immediately after first login!**

## 5. Start the Application

Open **two terminals**:

**Terminal 1 — Backend API (port 4000):**
```bash
npm run server
```

**Terminal 2 — Frontend (port 3000):**
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Default Credentials
- **Username:** superadmin
- **Password:** Admin@123

## Role Guide

| Role | Access |
|------|--------|
| Super Admin | Full system access |
| Branch Admin | Own branch only |
| Teacher | Assigned groups + attendance |
| Student | Own profile + schedule |

## Features
- Multi-language: English, Russian, Uzbek
- Dark/Light theme
- JWT authentication with refresh tokens
- Role-based access control
- Attendance tracking with late detection
- Branch management
- Group/class management
- Lesson schedule
- Notifications
- Activity logs
- Global search
- Profile photo upload
- Responsive design
