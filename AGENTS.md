# nsmts-film

## Agent work on GitHub

Dan assigns work with labels, since GitHub can't assign an App: `agent:claude`,
`agent:codex` or `agent:grok` (the issue names the Grok bot). When a session
starts, check for yours with `gh search issues --owner dfakkeldy --state open
--label agent:<you>`, and the same with `gh search prs`.

- Every session with Dan has an issue. If he delegated an issue to you or woke
  you on one, in any repo, that's it. Otherwise, at the start, use the open
  issue in his private hub repo (your user-level or bot instructions name it)
  that relates to what he's asking about, or open one there. A PR that
  finishes the issue says `Closes #N`. Otherwise the session is done when you
  ask Dan whether you can close the issue and he says yes.
- Only Dan hands work from one agent to another. Keep an issue or hand it back
  to Dan, never on to another agent.
- When you finish or get stuck, hand it back in one comment: what you did with
  the PR link, or the exact question. Then remove your `agent:` label. Comment
  only when the turn changes; progress goes in the PR.
- `go:claude` is Dan's label for waking Claude in GitHub Actions. Never add a
  `go:` label yourself. A `go:claude` run's issue is its session issue. The run
  has no Mac, board, Xcode or private notes: skip steps that need them, say so,
  and let CI on the PR build and test.
