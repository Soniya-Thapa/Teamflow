# TeamFlow Server (Backend)

Multi-tenant SaaS backend API built with Express.js, TypeScript, and PostgreSQL.

## 🛠️ Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL (Prisma ORM)
- **Cache:** Redis
- **Authentication:** JWT + bcrypt
- **Validation:** Zod
- **Logging:** Winston

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start Docker services (PostgreSQL + Redis)
cd .. && docker-compose up -d

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate
```

## 🚀 Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📝 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm test` | Run tests |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio (DB GUI) |

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1` | API info |

More endpoints will be added as we build features.

## 🌍 Environment Variables

See `.env.example` for all required environment variables.

## 📚 Project Structure

```
server/
├── src/
│   ├── config/          # Database, Redis configs
│   ├── modules/         # Feature modules
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript types
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── prisma/              # Database schema & migrations
├── tests/               # Test files
└── package.json
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:cov
```

## 🐳 Docker

Services are managed by docker-compose in the root folder.

```bash
# Start all services
cd .. && docker-compose up -d

# Stop all services
cd .. && docker-compose down

# View logs
cd .. && docker-compose logs -f
```

## 📖 Documentation

- [Database Schema](../docs/database-schema.md)
- API Documentation: Coming soon

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 📄 License

MIT