import { describe, expect, it } from 'vitest'
import { NotFoundPage } from './pages'

describe('route pages', () => { it('provides a not-found route component', () => { expect(NotFoundPage).toBeTypeOf('function') }) })
