# Visitor & Lead Management Platform Backend

A multi-tenant SaaS platform backend for managing visitor data and sales leads during exhibitions, trade shows, and in-store events.

## 🏗️ Architecture

- **Global Visitor Identity**: Visitors are stored once system-wide
- **Company-Specific Leads**: Each company interaction is tracked separately
- **Role-Based Access**: Platform Admin, Company Admin, and Employee roles
- **Mobile-First Design**: Optimized for mobile app integration

## 🚀 Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Secure password hashing with bcrypt
- Company context isolation

### Visitor Management
- Global visitor identity system
- Phone number-based search
- Duplicate prevention
- Profile management

### Lead Management
- Company-specific lead tracking
- Employee attribution
- Follow-up management
- Lead analytics and reporting

### Admin Dashboard
- Platform-wide analytics (Platform Admin)
- Company-specific insights (Company Admin)
- Employee performance tracking
- Real-time statistics

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Create new user (Platform Admin only)
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Visitors
- `GET /api/visitors/search/:phone` - Search visitors by phone
- `GET /api/visitors/:id` - Get visitor by ID
- `POST /api/visitors` - Create new visitor
- `PUT /api/visitors/:id` - Update visitor
- `GET /api/visitors` - List visitors (Admin only)
- `GET /api/visitors/stats/overview` - Visitor statistics

### Leads
- `POST /api/leads` - Create new lead
- `GET /api/leads` - List leads (with filtering)
- `GET /api/leads/:id` - Get lead by ID
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead (Admin only)
- `GET /api/leads/stats/overview` - Lead statistics

### Admin
- `GET /api/admin/companies` - List companies (Platform Admin)
- `POST /api/admin/companies` - Create company (Platform Admin)
- `PUT /api/admin/companies/:id` - Update company (Platform Admin)
- `GET /api/admin/users` - List users (Admin)
- `PUT /api/admin/users/:id/deactivate` - Deactivate user (Platform Admin)
- `GET /api/admin/dashboard/overview` - Platform dashboard
- `GET /api/admin/dashboard/company` - Company dashboard
- `GET /api/admin/dashboard/employee` - Employee dashboard

## 🔧 Setup

### Prerequisites
- Node.js 16+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials and JWT secret.

4. Set up the database tables using the provided SQL schema.

### Running the Server

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

The server will start on port 3000 (or PORT environment variable).

## 🗄️ Database Schema

### Core Tables
- `companies` - Organization/booth details
- `users` - Admin and employee accounts
- `visitors` - Global visitor identity
- `visitor_leads` - Company-specific interactions

### Key Relationships
- Users belong to companies (except platform admin)
- Leads connect visitors, companies, and employees
- Visitors are global; leads are company-specific

## 🔐 Security Features

- JWT token authentication
- Password hashing with bcrypt (12 rounds)
- Rate limiting
- CORS configuration
- Input validation with Joi
- SQL injection prevention with parameterized queries
- Role-based access control

## 📱 Mobile App Integration

The backend is designed to work seamlessly with mobile apps:

- Phone number-based visitor search
- Automatic visitor detail fetching
- Lead creation with employee attribution
- Real-time data synchronization

## 🎯 User Roles

### Platform Admin
- Manages all companies
- System-wide analytics
- User management across all companies

### Company Admin
- Manages their company
- Creates and manages employees
- Company-specific analytics

### Employee
- Registers visitors via mobile app
- Creates and manages leads
- Views their own performance metrics

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Joi
- **Password Hashing**: bcryptjs

## 📊 Error Handling

- Global error handler
- Consistent error response format
- Detailed logging
- Input validation errors
- Database error handling

## 🔄 Environment Variables

```env
PORT=3000
NODE_ENV=development

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:19006
```

## 📝 API Response Format

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": [...]
}
```

## 🚀 Deployment

The backend is designed for deployment on platforms like Render, Heroku, or any Node.js hosting service.

### Production Considerations
- Use environment variables for secrets
- Enable SSL/TLS
- Configure proper CORS origins
- Set up database connection pooling
- Implement logging and monitoring
- Regular security updates

## 📞 Support

For technical support or questions about the API, please refer to the documentation or contact the development team.
