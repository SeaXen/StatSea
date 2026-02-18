# Contributing to StatSea

Thank you for your interest in contributing to StatSea! We welcome contributions from everyone.

## Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/statsea.git
    cd statsea
    ```
3.  **Install dependencies**:
    - Backend:
      ```bash
      cd backend
      pip install -r requirements.txt
      ```
    - Frontend:
      ```bash
      cd frontend
      npm install
      ```

## Development Workflow

1.  Create a new branch for your feature or fix:
    ```bash
    git checkout -b feature/my-new-feature
    ```
2.  Make your changes.
3.  Run tests to ensure no regressions:
    - Backend: `pytest`
    - Frontend: `npm test`
4.  Commit your changes with clear messages.
5.  Push to your fork and submit a Pull Request.

## Coding Standards

- **Frontend**:
    - Use React Functional Components and Hooks.
    - Follow the existing folder structure.
    - Use Tailwind CSS for styling.
    - Ensure accessibility (ARIA labels) where appropriate.

- **Backend**:
    - Follow PEP 8 style guide.
    - Use type hints for function arguments and return values.
    - Write unit tests for new logic.

## Pull Request Guidelines

- Provide a clear description of what the PR does.
- Link to any relevant issues.
- Ensure all tests pass.
- Request a review from the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
