# Claude Command: Commit

This command helps you create well-formatted commits with conventional commit messages and emoji.

## Usage

To create a commit, just type:

```
/commit
```

## What This Command Does

1. Checks which files are staged with `git status`
2. If 0 files are staged, automatically adds all modified and new files with `git add`
3. Performs a `git diff` to understand what changes are being committed
4. Analyzes the diff to determine if multiple distinct logical changes are present
5. If multiple distinct changes are detected, suggests breaking the commit into multiple smaller
   commits
6. For each commit (or the single commit if not split), creates a commit message using emoji
   conventional commit format

## Best Practices for Commits

- **Atomic commits**: Each commit should contain related changes that serve a single purpose
- **Split large changes**: If changes touch multiple concerns, split them into separate commits
- **Conventional commit format**: You MUST use the format `<type>: <description>` where type is one
  of:
    - `feat`: A new feature
    - `fix`: A bug fix
    - `docs`: Documentation changes
    - `style`: Code style changes (formatting, etc)
    - `refactor`: Code changes that neither fix bugs nor add features
    - `test`: Adding or fixing tests
    - 'ci': Changes to build pipelines and configurations
- **Present tense, imperative mood**: Write commit messages as commands (e.g., "add feature" not "
  added feature")
- **Concise first line**: Keep the first line under 72 characters
- **Emoji**: Each commit type is paired with an appropriate emoji:
    - ✨ `feat`: New feature
    - 🐛 `fix`: Bug fix
    - 📝 `docs`: Documentation
    - 💄 `style`: Formatting/style
    - ♻️ `refactor`: Code refactoring
    - ✅ `test`: Tests
    - 🚀 `ci`: CI/CD improvements
    - 🧪 `test`: Add a failing test
    - 🚨 `fix`: Fix compiler/linter warnings
    - 🔒️ `fix`: Fix security issues
    - 🚚 `refactor`: Move or rename resources
    - 🏗️ `refactor`: Make architectural changes
    - 🧵 `feat`: Add or update code related to multithreading or concurrency
    - 🔍️ `feat`: Improve SEO
    - 🏷️ `feat`: Add or update types
    - 💬 `feat`: Add or update text and literals
    - 🌐 `feat`: Internationalization and localization
    - 👔 `feat`: Add or update business logic
    - 📱 `feat`: Work on responsive design
    - 🚸 `feat`: Improve user experience / usability
    - 🩹 `fix`: Simple fix for a non-critical issue
    - 🥅 `fix`: Catch errors
    - 👽️ `fix`: Update code due to external API changes
    - 🔥 `fix`: Remove code or files
    - 🎨 `style`: Improve structure/format of the code
    - 🚑️ `fix`: Critical hotfix
    - 💚 `fix`: Fix CI build
    - 👷 `ci`: Add or update CI build system
    - 📈 `feat`: Add or update analytics or tracking code
    - ✏️ `fix`: Fix typos
    - 💥 `feat`: Introduce breaking changes
    - ♿️ `feat`: Improve accessibility
    - 💡 `docs`: Add or update comments in source code
    - 🔊 `feat`: Add or update logs
    - 🔇 `fix`: Remove logs
    - 🤡 `test`: Mock things
    - 🥚 `feat`: Add or update an easter egg
    - 📸 `test`: Add or update snapshots
    - 🚩 `feat`: Add, update, or remove feature flags
    - ⚰️ `refactor`: Remove dead code
    - 🦺 `feat`: Add or update code related to validation
    - ✈️ `feat`: Improve offline support

## Guidelines for Splitting Commits

When analyzing the diff, consider splitting commits based on these criteria:

1. **Different concerns**: Changes to unrelated parts of the codebase
2. **Different types of changes**: Mixing features, fixes, refactoring, etc.
3. **File patterns**: Changes to different types of files (e.g., source code vs documentation)
4. **Logical grouping**: Changes that would be easier to understand or review separately
5. **Size**: Very large changes that would be clearer if broken down

## Examples

Good commit messages:

- ✨ feat: add user authentication system
- 🐛 fix: resolve memory leak in rendering process
- 📝 docs: update API documentation with new endpoints
- ♻️ refactor: simplify error handling logic in parser
- 🚨 fix: resolve linter warnings in component files
- 👔 feat: implement business logic for transaction validation
- 🩹 fix: address minor styling inconsistency in header
- 🚑️ fix: patch critical security vulnerability in auth flow
- 🎨 style: reorganize component structure for better readability
- 🔥 fix: remove deprecated legacy code
- 🦺 feat: add input validation for user registration form
- 💚 fix: resolve failing CI pipeline tests
- 📈 feat: implement analytics tracking for user engagement
- 🔒️ fix: strengthen authentication password requirements
- ♿️ feat: improve form accessibility for screen readers

Example of splitting commits:

- First commit: ✨ feat: add new API endpoint for user authentication
- Second commit: 📝 docs: update documentation for API endpoint
- Third commit: 🏷️ feat: add type definitions for new API endpoint
- Fourth commit: 🧵 feat: improve concurrency handling in worker threads
- Fifth commit: 🚨 fix: resolve linting issues in new code
- Sixth commit: ✅ test: add unit tests for new API endpoint
- Seventh commit: 🔒️ fix: update dependencies with security vulnerabilities

## Important Notes

- If specific files are already staged, the command will only commit those files
- If no files are staged, it will automatically stage all modified and new files
- The commit message will be constructed based on the changes detected
- Before committing, the command will review the diff to identify if multiple commits would be more
  appropriate
- If suggesting multiple commits, it will help you stage and commit the changes separately
- Always reviews the commit diff to ensure the message matches the changes
- You MUST adhere to the commit message format defined here, regardless of existing commit messages