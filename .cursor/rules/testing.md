---
description: Testing standards with Vitest
globs: "**/*.test.ts, **/*.test.tsx, **/*.spec.ts"
---

# Testing Standards

## Framework

This project uses **Vitest** for testing.

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

## Test File Organization

```
src/
├── lib/
│   ├── redis.ts
│   └── redis.test.ts      # Co-located test file
├── components/
│   └── Button/
│       ├── Button.tsx
│       └── Button.test.tsx
```

## Test Structure

### Unit Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { myFunction } from './myFunction'

describe('myFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return expected result for valid input', () => {
    const result = myFunction('valid input')
    expect(result).toBe('expected output')
  })

  it('should throw error for invalid input', () => {
    expect(() => myFunction('')).toThrow('Invalid input')
  })

  it('should handle edge cases', () => {
    expect(myFunction(null)).toBeNull()
    expect(myFunction(undefined)).toBeUndefined()
  })
})
```

### Async Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { fetchData } from './api'

describe('fetchData', () => {
  it('should fetch data successfully', async () => {
    const data = await fetchData('123')
    expect(data).toHaveProperty('id', '123')
  })

  it('should handle errors', async () => {
    await expect(fetchData('invalid')).rejects.toThrow()
  })
})
```

### Mocking

```typescript
import { describe, it, expect, vi } from 'vitest'

// Mock a module
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: mockData, error: null }))
        }))
      }))
    }))
  }))
}))

// Mock environment variables
vi.stubEnv('GEMINI_API_KEY', 'test-key')
```

### Component Tests

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    
    fireEvent.click(screen.getByText('Click'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('should be disabled when loading', () => {
    render(<Button loading>Submit</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

## Test Categories

### What to Test

| Category | Priority | Examples |
|----------|----------|----------|
| **Business Logic** | High | Validation, calculations, transformations |
| **Server Actions** | High | CRUD operations, authentication |
| **Utilities** | Medium | Formatters, parsers, helpers |
| **Hooks** | Medium | Custom hooks with complex logic |
| **Components** | Low | Interactive components, form handling |

### What NOT to Test

- Third-party library internals
- Simple pass-through functions
- Static content rendering
- TypeScript type definitions

## Test Naming Conventions

```typescript
describe('ComponentName or functionName', () => {
  describe('method or scenario', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      // Act
      // Assert
    })
  })
})
```

## Server Action Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createChatSession } from '@/app/actions/chat'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

describe('createChatSession', () => {
  it('should create a new session for authenticated user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } }
    })
    
    const result = await createChatSession({
      title: 'Test Session',
      course: 'CS101'
    })
    
    expect(result.status).toBe('success')
    expect(result.data).toHaveProperty('id')
  })

  it('should return error for unauthenticated user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null }
    })
    
    const result = await createChatSession({ title: 'Test' })
    
    expect(result.status).toBe('error')
    expect(result.message).toBe('Unauthorized')
  })
})
```

## Coverage Requirements

Aim for reasonable coverage on critical paths:

| Area | Target |
|------|--------|
| Server Actions | 80%+ |
| Utilities | 90%+ |
| Validation | 100% |
| Components | 60%+ |

## Running Tests

```bash
# Run all tests
npm test

# Run specific file
npm test -- src/lib/redis.test.ts

# Run tests matching pattern
npm test -- --grep "authentication"

# Update snapshots
npm test -- -u
```

## CI Integration

Tests should pass before merge:

```yaml
# In CI pipeline
- name: Run tests
  run: npm test -- --coverage --reporter=verbose
```
