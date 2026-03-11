# Contributing to Security Review System

Thank you for your interest in contributing! This project is an academic/experimental security review platform, and contributions are welcome.

## Getting Started

1. **Fork** the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/Reposec.git
   cd Reposec
   ```

2. **Run the setup script** to install all dependencies:

   | OS | Command |
   |---|---|
   | Windows | `setup.bat` |
   | macOS / Linux | `chmod +x setup.sh && ./setup.sh` |

3. **Activate the virtual environment**:

   | OS | Command |
   |---|---|
   | Windows | `.venv\Scripts\activate` |
   | macOS / Linux | `source .venv/bin/activate` |

## Development Workflow

### Backend (Python / FastAPI)

- Source code is in `orchestrator/`, `dashboard/`, `agents/`, and `main.py`
- Run the dashboard in dev mode: `python main.py --dashboard`
- Run tests: `pytest tests/ -v`

### Frontend (React / Vite / TypeScript)

- Source code is in `frontend/src/`
- Run the dev server (with hot reload):
  ```bash
  cd frontend
  npm run dev
  ```
  The Vite dev server runs on `http://localhost:5173` and proxies API calls to FastAPI on port 8000.

- Build for production:
  ```bash
  npm run build
  ```

## Running Tests

```bash
# Install dev dependencies
pip install -r requirements-dev.txt

# Run the full test suite
pytest tests/ -v
```

## Pull Request Guidelines

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Keep commits focused** — one logical change per commit.

3. **Run tests** before submitting to make sure nothing is broken.

4. **Open a Pull Request** with a clear description of what you changed and why.

## Project Structure

```
SecurityReviewSystem/
├── agents/          # Markdown prompt templates for each review agent
├── dashboard/       # FastAPI backend (API + DB logic + report parsing)
├── frontend/        # React SPA (Vite + TypeScript + Tailwind)
├── orchestrator/    # LangGraph workflow, nodes, OpenCode integration
├── knowledge/       # Reference material (OWASP, Secure by Design)
├── tests/           # Pytest test suite
├── main.py          # CLI entry point
└── config.py        # Configuration
```

## Questions?

Open an [issue](../../issues) if you have questions or run into problems.
