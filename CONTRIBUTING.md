# Contributing to OpenLoom

Thanks for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/OpenLoom.git`
3. Install dependencies: `npm install`
4. Copy env: `cp .env.example .env`
5. Start dev environment: `docker compose up db minio -d && npm run dev`
6. Open `http://localhost:3000`

## Development

```bash
npm run dev       # Start Next.js dev server
npm run lint      # Run ESLint
npm run typecheck # Run TypeScript checks
npm run test      # Run tests
```

## Pull Requests

- Create a feature branch from `main`
- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why
- Add tests for new functionality
- Ensure all checks pass before requesting review

## Reporting Issues

Use GitHub Issues. Include:
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Docker version, browser)
- Screenshots or screen recordings if applicable

## Code Style

- TypeScript strict mode
- Functional components with hooks
- Tailwind CSS for styling
- Prisma for database access

## License

By contributing, you agree that your contributions will be licensed under AGPL-3.0.
