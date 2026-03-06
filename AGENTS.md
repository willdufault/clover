# AGENTS.md

**General:**
- Keep responses extremely concise
- Ask for clarification if requirements are ambiguous
- Don't assume unstated requirements
- Avoid risky operations or data loss
- Prioritize producing correct results over clever solutions
- Only perform tasks explicitly requested

**Architecture:**
- Keep designs simple and modular
- Favor clarity and maintainability over clever or overly complex patterns
- Minimize dependencies between components
- Document key architectural decisions and reasoning
- Only implement what is necessary to meet the requirements
- Reuse patterns and components consistently across the project
- Prefer using established patterns instead of creating new ones unless necessary

**Coding:**
- Use clear, self-explanatory variable, function, and class names
- Use variables or enums instead of unclear inline values for clarity (ex: `ANSI_CLEAR = /033c`, `SECONDS_PER_DAY = 86400`, `status = Status.Busy`)
- Only add comments for complex code, important context, or unintuitive behavior
- Use guard statements to avoid deep nesting
- Always prefer simple, readable code over complex code
- Write the minimum code required to solve a problem
- Extract repeated logic into variables, functions, or classes
- Use intermediate variables to break up complex expressions
- Use enums for predefined sets of values
- Use moderate whitespace to clearly separate code blocks and improve readability
- Use Windows line endings (CRLF)

**Skills:**
- Apply language- or domain-specific rules from `.agent/skills/`
- Only use the skill files relevant to the current task
