# 🚀 TeamFlow

> Multi-Tenant SaaS Platform for Team Collaboration & Task Management

## 📋 Overview

TeamFlow is an enterprise-grade multi-tenant SaaS platform designed to help teams manage projects, tasks, and collaboration efficiently. Built with modern technologies and best practices, it demonstrates professional backend architecture suitable for production environments.

## ✨ Features

- ✅ **Multi-Tenant Architecture** - Complete data isolation per organization
- ✅ **Role-Based Access Control** - Owner, Admin, Member, Guest roles
- ✅ **Project Management** - Organize work into projects
- ✅ **Task Management** - Full task lifecycle (TODO → IN_PROGRESS → DONE)
- ✅ **Team Collaboration** - Comments, mentions, real-time updates
- ✅ **User Invitations** - Email-based secure onboarding
- ✅ **Activity Logs** - Complete audit trail
- ✅ **File Attachments** - Cloud storage integration

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Cache:** Redis
- **Authentication:** JWT + bcrypt
- **Validation:** Zod
- **Logging:** Winston

### Frontend (Coming Soon)
- React / Next.js
- TypeScript
- Tailwind CSS

### DevOps
- Docker & Docker Compose
- GitHub Actions (CI/CD)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- Docker & Docker Compose ([Download](https://www.docker.com/get-started))
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/TeamFlow.git
cd TeamFlow

# Start Docker services (PostgreSQL + Redis)
docker-compose up -d

# Setup backend
cd server
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate

# Start development server
npm run dev
```

The API will be available at: **http://localhost:5000/api/v1**

### Health Check

```bash
curl http://localhost:5000/health
```

## 📁 Project Structure

```
TeamFlow/
├── server/              # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── config/     # Database, Redis configs
│   │   ├── modules/    # Feature modules (auth, users, etc.)
│   │   ├── middleware/ # Express middleware
│   │   ├── utils/      # Utility functions
│   │   └── types/      # TypeScript types
│   ├── prisma/         # Database schema & migrations
│   └── tests/          # Test files
├── client/             # Frontend (Coming soon)
├── docker-compose.yml  # Docker services
└── README.md
```

## 📚 Documentation

- [Server README](./server/README.md)
- [Database Schema](./docs/database-schema.md)
- [API Documentation](./docs/api-docs.md) (Coming soon)

## 🐳 Docker Services

| Service | Port | Credentials |
|---------|------|-------------|
| **PostgreSQL** | 5432 | teamflow_user / teamflow_pass |
| **Redis** | 6379 | No password |
| **pgAdmin** | 5050 | admin@teamflow.local / admin123 |

Access pgAdmin: http://localhost:5050

## 🧪 Testing

```bash
cd server
npm test
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)
- LinkedIn: [Your Profile](https://linkedin.com/in/yourprofile)

## 🙏 Acknowledgments

- Built with modern best practices
- Inspired by industry-leading SaaS platforms
- Community feedback and contributions

---

**⭐ If you find this project useful, please give it a star!**