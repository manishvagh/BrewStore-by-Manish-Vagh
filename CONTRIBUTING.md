# Contributing to BrewStore

Thanks for your interest in improving BrewStore.

## Workflow

1. Fork the repository (or create a branch if you have write access).
2. Create a feature branch from `main`.
3. Open a **Pull Request** into `main`.
4. Wait for review and approval from the repository owner (`@manishvagh`).
5. After approval, the PR can be merged.

Direct pushes to `main` are blocked. Force-pushes and deleting `main` are disabled. Stale approvals are dismissed when new commits are pushed.

Repository admins may bypass required reviews when necessary (for example, urgent hotfixes). Everyone else must use a pull request with owner approval.

## Guidelines

- Keep changes focused and well described in the PR.
- Test install / update / uninstall flows against Homebrew when touching package management code.
- Do not commit secrets, tokens, or local machine paths.
