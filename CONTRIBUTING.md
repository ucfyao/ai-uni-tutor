# Contributing Guide

Thank you for your interest in contributing to AI Uni Tutor! This document provides guidelines and standards for contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/ai-uni-tutor.git`
3. Install dependencies: `npm install`
4. Create a new branch: `git checkout -b feat/your-feature`

## Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Run tests
npm test
```

## Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | Description                                       |
| ---------- | ------------------------------------------------- |
| `feat`     | A new feature                                     |
| `fix`      | A bug fix                                         |
| `docs`     | Documentation only changes                        |
| `style`    | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code refactoring (no feature or bug fix)          |
| `perf`     | Performance improvements                          |
| `test`     | Adding or updating tests                          |
| `chore`    | Maintenance tasks                                 |
| `build`    | Build system or dependencies                      |
| `ci`       | CI/CD configuration                               |
| `revert`   | Reverting a previous commit                       |

### Scopes

| Scope    | Description                         |
| -------- | ----------------------------------- |
| `chat`   | Chat interface and messaging        |
| `rag`    | RAG pipeline (embedding, retrieval) |
| `api`    | API routes and endpoints            |
| `ui`     | UI components and styling           |
| `auth`   | Authentication and authorization    |
| `stripe` | Payment and subscription            |
| `db`     | Database and Supabase               |
| `deps`   | Dependencies updates                |
| `config` | Configuration files                 |

### Examples

```bash
# Feature with scope
feat(chat): add message streaming support

# Bug fix
fix(rag): resolve embedding dimension mismatch

# Documentation
docs(api): update API documentation

# Dependency update
chore(deps): upgrade Next.js to 16.1.4

# Breaking change
feat(api)!: change response format for chat endpoint

BREAKING CHANGE: Response now returns { data, meta } instead of raw data
```

### Interactive Commit

Use the interactive commit wizard:

```bash
npm run commit
```

This will guide you through creating a properly formatted commit message.

## Code Style

### TypeScript

- Use strict TypeScript types
- Avoid `any` type - use `unknown` if needed
- Define interfaces for component props
- Add return types to functions

### React Components

- Prefer Server Components by default
- Use `'use client'` only when necessary
- Keep components focused and single-purpose
- Use Mantine UI components for consistency

### File Organization

```
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components
├── lib/           # Utility functions and services
├── context/       # React Context providers
└── types/         # TypeScript type definitions
```

## Pull Request Process

1. Ensure your code passes all checks:

   ```bash
   npm run lint
   npm run build
   npm test
   ```

2. Update documentation if needed

3. Create a Pull Request with:
   - Clear title following commit convention
   - Description of changes
   - Screenshots for UI changes
   - Link to related issues

4. Wait for code review and address feedback

## Git Hooks

This project uses Husky for Git hooks:

- **pre-commit**: Runs ESLint and Prettier on staged files
- **commit-msg**: Validates commit message format
- **pre-push**: Runs build to catch errors before pushing

## Questions?

If you have questions, feel free to open an issue or discussion on GitHub.
