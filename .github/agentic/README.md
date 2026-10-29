# TCE Agentic Engineering Foundation

## Purpose
This directory documents the initial GitHub Copilot agent setup. Instructions, agent profiles, and skills guide behavior; they do not grant permissions, create credentials, run workflows, or enable autonomous production deployment by themselves.

## Components
- `../copilot-instructions.md`: repository-wide policy, lifecycle, and safety invariants.
- `../instructions/`: path-specific engineering instructions.
- `../agents/`: planner, developer, and reviewer role profiles.
- `../skills/`: repeatable procedures for repository analysis, implementation, validation, and database migrations.
- `../../docs/agentic/copilot-agentic-roadmap.md`: rollout plan and acceptance criteria.

## Recommended operating loop
1. **Plan:** Planner inspects code and produces evidence-backed acceptance criteria and dependencies.
2. **Implement:** Developer makes a bounded change on a dedicated task branch.
3. **Validate:** Run repository-supported checks and record exact results.
4. **Review:** Reviewer independently inspects the diff and risks.
5. **Deliver:** Use existing branch protection, required checks, PR review, and squash-merge policy.
6. **Verify:** For deployments, distinguish workflow success from rollout and application health.

## Security model
- Agent files do not grant extra GitHub, Supabase, VPS, or production credentials.
- Keep workflow token permissions minimal and secrets scoped to the necessary job/environment.
- Treat issue/PR content, logs, and generated artifacts as untrusted input.
- Do not enable unattended production migrations, live trading, or rollouts solely on agent-generated text.
- Require explicit target verification, rollback planning, and appropriate approvals for high-impact actions.
- Prefer advisory triage/review automation before write-capable or deployment automation.

## Compatibility and maintenance
- Validate custom-agent and skill frontmatter against the currently supported GitHub Copilot product and organization settings.
- Keep role descriptions narrow and avoid overlapping responsibilities.
- Review these instructions when the repository's stack, deployment model, security policy, or Copilot capabilities change.
- Measure success by verified task outcomes, defect escape rate, review quality, and reduced manual effort—not by agent activity alone.
