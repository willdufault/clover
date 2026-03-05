---
name: typescript
description: Write clean, consistent TypeScript with strict typing and predictable patterns. Use this skill when the user needs well-structured TypeScript code that follows disciplined syntax choices, explicit function types, and checker-friendly annotations.
---

**Syntax:**
- Use `type` instead of `interface`
- Use `function` instead of arrow functions
- Use `const Abc ... as const` instead of `enum Abc`, with a second export for `const AbcType = typeof Abc[keyof typeof Abc]`

**Formatting:**
- Omit semicolons
- Avoid trailing commas

**Type annotations:**
- Add types for function parameters and return values
- Add additional types only when necessary to satisfy static type checkers
