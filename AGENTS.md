<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Every tournament-scoped row carries its own `tournament_id`, and cross-table links use composite foreign keys on `(id, tournament_id)` so a row from another tournament can never be linked. Why: RLS policies and per-tournament isolation both read that column, so a mismatched link would leak or corrupt another organizer's data.
- New application tables follow the existing access pattern in `drizzle/migrations`: GRANTs first, then RLS enabled, then policies built on `can_edit_tournament` / `is_tournament_public`. Why: without GRANTs the Data API blocks the table even with policies.
