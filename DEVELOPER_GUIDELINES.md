# Developer Guidelines

## General Development Principles

### 1. Translation Usage
- Always use the translation system (`useI18n`) instead of embedding strings directly in code
- All UI text elements must be localized
- Comments in the code should be in english
- When adding new UI strings:
  - Add the key to the `Translations` interface in `src/i18n/translations.ts`
  - Add translations for all supported languages (en, ru)

### 2. Styling
- Do not use inline styles (`style={{}}`) in JSX
- Instead, define CSS classes and add styles to appropriate CSS files
- Follow BEM methodology for naming classes
- Use CSS variables for colors and other common values

### 3. Component Structure
- Separate logic and presentation
- Use hooks for state management
- Pay attention to performance and use `memo`, `useCallback`, `useMemo` when needed

### 4. Architectural Principles
- Follow the Flux/Redux pattern for state management
- Use MobX for reactive programming
- Separate business logic and UI logic

### 5. Testing
- Write unit tests for business logic
- Use snapshot tests for components
- Ensure test coverage for important parts of the application

### 6. Compatibility
- Ensure changes are compatible with supported browser versions
- Maintain backward compatibility for APIs
- Update documentation when making changes to public interfaces