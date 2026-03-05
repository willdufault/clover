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
- Replace unclear literal values, like `/033c`, with variables, constants, or enums for clarity
- Only add comments for complex code or important context
- Use guard statements to avoid deep nesting
- Prefer simple, readable code over optimal or clever solutions
- Write the minimum code required to solve a problem
- Extract repeated logic into variables, functions, or classes
- Use intermediate variables to break up complex expressions
- Use enums for predefined sets of values
- Use moderate whitespace to clearly separate code blocks and improve readability
- Use Windows line endings (CRLF)

**Skills:**
- Apply language- or domain-specific rules from `.agent/skills/`
- Only use the skill files relevant to the current task
