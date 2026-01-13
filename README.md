<div align="center">

# 🍽️ MyTable

### Premium Private Dining & Chef Booking Platform

*Connecting discerning clients with exceptional culinary talent*

[![Next.js](https://img.shields.io/badge/Next.js-14.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-green?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Status](https://img.shields.io/badge/Status-Active%20Development-yellow?style=for-the-badge)]()

---

</div>

## ✨ Overview

**MyTable** is a premium, client-focused platform that revolutionizes private dining experiences by connecting clients directly with curated chefs. Built with modern web technologies and a human-centric approach, MyTable delivers an elegant, seamless booking experience for high-end culinary services.

> **Note:** This is a private client project in active development. The platform is continuously evolving with new features and improvements.

---

## 🎯 Vision

MyTable bridges the gap between exceptional culinary talent and clients seeking personalized dining experiences. We believe in:

- **Curated Excellence** — Every chef is carefully vetted and brings unique expertise
- **Human Connection** — Direct communication between clients and chefs
- **Seamless Experience** — From booking to execution, every touchpoint is refined
- **Premium Quality** — Built for those who value exceptional service

---

## 🚀 Key Features

### Current Capabilities

#### 📅 **Multi-Service Booking System**
- **Home Dining** — Private meals at your location
- **Cooking Classes** — Personalized culinary education
- **Multi-Day Events** — Extended chef services with custom meal planning

#### 💬 **Real-Time Communication**
- Instant messaging between clients and chefs
- Optimistic UI for seamless interactions
- Mobile-optimized chat interface
- Message notifications via email

#### 🔐 **Secure Authentication**
- Passwordless authentication via magic links
- Role-based access (client, chef, admin)
- Secure token-based decision system

#### 📧 **Automated Workflows**
- Transactional email notifications
- Booking confirmation system
- Status update communications
- Automated reminders

#### 🌍 **Internationalization**
- Full English/French support
- Seamless language switching
- Localized date/time formatting
- Timezone-aware date handling

#### 🎨 **Premium UI/UX**
- Modern, minimalist design
- Mobile-first responsive layout
- Smooth animations and transitions
- Accessible and intuitive interface

### Coming Soon

- Advanced menu customization
- Payment integration
- Calendar synchronization
- Review and rating system
- Chef portfolio enhancements

---

## 🏗️ Product Philosophy

### Design Principles

**Premium, Not Pretentious**
- Clean, confident interfaces
- Thoughtful micro-interactions
- Editorial-quality typography
- Intentional use of space

**Human-Centric**
- Direct chef-client communication
- Transparent booking process
- Clear status visibility
- Empathetic error handling

**Mobile-First**
- Optimized for one-thumb navigation
- Fast, responsive interactions
- Offline-capable features
- Native-feeling experience

**Scalable Architecture**
- Modular component system
- Type-safe development
- Efficient data management
- Performance-optimized

---

## 🛠️ Tech Stack

### Core Framework
- **[Next.js 14](https://nextjs.org/)** — React framework with App Router
- **[TypeScript](https://www.typescriptlang.org/)** — Type-safe development
- **[React 18](https://react.dev/)** — Modern UI library

### Backend & Database
- **[Supabase](https://supabase.com/)** — PostgreSQL database with Realtime
- **Row Level Security (RLS)** — Secure data access
- **Real-time subscriptions** — Live chat functionality

### Styling & UI
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling
- **Custom design system** — Premium component library
- **Responsive design** — Mobile-first approach

### Authentication & Security
- **Supabase Auth** — Passwordless magic links
- **Token-based decisions** — Secure booking workflows
- **bcrypt** — Secure token hashing

### Communication
- **[Resend](https://resend.com/)** — Transactional emails
- **Email templates** — Professional communications
- **Notification system** — Real-time updates

### Development Tools
- **ESLint** — Code quality
- **TypeScript** — Type checking
- **Playwright** — End-to-end testing

---

## 📐 Project Structure

```
MyTable-app/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── bookings/            # Booking management
│   │   ├── booking-validate/    # Booking validation
│   │   └── booking-menu/        # Menu management
│   ├── book/[chefSlug]/         # Booking pages
│   ├── chat/[conversationId]/   # Chat interface
│   ├── dashboard/               # User dashboard
│   └── admin/                   # Admin panel
│
├── components/                   # React components
│   ├── ui/                      # Reusable UI components
│   ├── BookingForm.tsx          # Multi-step booking form
│   ├── ChatInterface.tsx        # Real-time chat
│   └── LanguageSwitcher.tsx     # i18n switcher
│
├── lib/                         # Utilities & helpers
│   ├── supabase/                # Supabase clients
│   ├── dateUtils.ts             # Date handling
│   ├── email.ts                 # Email abstraction
│   └── i18n/                    # Internationalization
│
├── supabase/                    # Database
│   └── migrations/              # SQL migrations
│
├── types/                       # TypeScript definitions
│   └── database.ts              # Database types
│
└── messages/                    # i18n translations
    ├── en.json
    └── fr.json
```

---

## 🎨 Design System

### Visual Identity

**Color Palette**
- Primary: `#FBCF03` — Confident yellow
- Neutral: Black, white, grays
- Accent: Subtle gradients and shadows

**Typography**
- Clean, readable fonts
- Clear hierarchy
- Editorial spacing

**Components**
- Glass-morphism effects
- Smooth transitions
- Intentional micro-interactions
- Premium feel throughout

---

## 🗺️ Roadmap

### Short-Term (Current Sprint)
- ✅ Date handling normalization
- ✅ Menu validation improvements
- ✅ Premium UI refinements
- 🔄 Payment integration
- 🔄 Enhanced admin tools

### Mid-Term (Next Quarter)
- Advanced search and filtering
- Chef portfolio system
- Client review system
- Analytics dashboard
- Mobile app (PWA)

### Long-Term Vision
- Multi-region expansion
- Chef marketplace features
- Subscription models
- API for third-party integrations

---

## ⚙️ Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Resend account (for emails)

### Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
# Execute supabase/migrations/*.sql in Supabase SQL Editor

# Start development server
npm run dev
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
EMAIL_PROVIDER=resend
```

### Available Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # Code linting
npm run test:e2e     # End-to-end tests
```

---

## 📊 Architecture Highlights

### Real-Time Communication
- Supabase Realtime subscriptions for instant messaging
- Optimistic UI updates for seamless UX
- Message persistence and history

### Date Handling
- Timezone-aware date management
- Normalized date parsing and formatting
- Consistent date display across all services

### Booking Workflow
- Multi-step form with validation
- Token-based secure decision system
- Automated email notifications
- Status tracking and updates

### Internationalization
- Full i18n support (EN/FR)
- Dynamic language switching
- Localized content and formatting

---

## 🔒 Security & Privacy

- **Row Level Security (RLS)** — Database-level access control
- **Token Hashing** — Secure decision tokens with bcrypt
- **Passwordless Auth** — Magic link authentication
- **Input Validation** — Client and server-side validation
- **Type Safety** — TypeScript throughout

---

## 📈 Performance

- **Server-Side Rendering** — Fast initial loads
- **Code Splitting** — Optimized bundle sizes
- **Image Optimization** — Next.js Image component
- **Caching Strategies** — Efficient data fetching
- **Mobile Optimization** — Responsive and fast

---

## 🧪 Testing

- **Unit Tests** — Core utilities and functions
- **Component Tests** — UI component validation
- **E2E Tests** — Playwright for critical flows
- **Type Checking** — TypeScript strict mode

---

## 📝 Work in Progress

This project is actively being developed and improved. Features are added regularly, and the platform evolves based on user feedback and business needs.

**Current Focus Areas:**
- Enhanced booking experience
- Improved mobile UX
- Performance optimizations
- Feature completeness

---

## 🤝 Contributing

This is a private client project. For questions or collaboration, please contact the project maintainers.

---

## 📄 License

Private project — All rights reserved.

---

<div align="center">

**Built with care for exceptional dining experiences**

*MyTable © 2024*

</div>
