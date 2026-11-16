"""Proves that packages from src/lib/core/anki/apkg.ts survive Anki's real importer.

Dev-only. Builds test packages with scripts/make-test-apkg.ts, imports them into throwaway
collections with the import options a normal user gets by default, and checks that re-importing
an updated deck updates notes in place and keeps scheduling.

    uv run --with anki python scripts/anki-import-check.py

Exits non-zero if any check fails.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from anki.buildinfo import version as anki_version
from anki.collection import Collection, ImportAnkiPackageRequest
from anki.scheduler.v3 import CardAnswer

ROOT = Path(__file__).resolve().parent.parent
results: list[tuple[bool, str, str]] = []
limits: list[tuple[bool, str, str]] = []


def check(name: str, ok: bool, detail: object = "") -> bool:
    results.append((bool(ok), name, str(detail)))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail != "" else ""))
    return bool(ok)


def known(name: str, ok: bool, detail: object = "") -> None:
    """A behaviour we would like but Anki does not provide. Reported, but does not fail the run."""
    tag = "UNEXPECTED-PASS" if ok else "KNOWN-LIMIT"
    results.append((True, name, str(detail)))
    limits.append((ok, name, str(detail)))
    print(f"  {tag}  {name}" + (f"  [{detail}]" if detail != "" else ""))


def note(msg: str) -> None:
    print(f"  ....  {msg}")


def import_pkg(col: Collection, path: str, label: str):
    # The presets are what Anki's import screen starts with for a normal user.
    options = col._backend.get_import_anki_package_presets()
    res = col.import_anki_package(ImportAnkiPackageRequest(package_path=path, options=options))
    log = res.log
    note(
        f"import {label}: new={len(log.new)} updated={len(log.updated)} "
        f"duplicate={len(log.duplicate)} conflicting={len(log.conflicting)} "
        f"first_field_match={len(log.first_field_match)} missing_notetype={len(log.missing_notetype)} "
        f"missing_deck={len(log.missing_deck)} empty_first_field={len(log.empty_first_field)}"
    )
    return log


def nid_by_guid(col: Collection) -> dict[str, int]:
    return {g: i for i, g in col.db.all("select id, guid from notes")}


def new_queue_guids(col: Collection, deck_id: int) -> list[str]:
    col.decks.select(deck_id)
    queued = col.sched.get_queued_cards(fetch_limit=100)
    return [col.get_card(q.card.id).note().guid for q in queued.cards if q.card.queue == 0]


def deck_named(col: Collection, name: str):
    return col.decks.by_name(name)


def scenario_update(pkgs: dict, m: dict, tmp: Path) -> None:
    print("\n== Scenario 1: import v1, study, import v2 ==")
    col = Collection(str(tmp / "update.anki2"))
    try:
        opts = col._backend.get_import_anki_package_presets()
        note(f"default import options: {str(opts).strip() or '(all proto defaults)'}".replace("\n", ", "))
        note(
            "  i.e. update_notes=IF_NEWER, update_notetypes=IF_NEWER, merge_notetypes=False, "
            "with_scheduling=False, with_deck_configs=False unless printed otherwise"
        )

        import_pkg(col, pkgs["v1"], "v1")
        ids = nid_by_guid(col)
        check("v1: note count is 5", col.note_count() == 5, col.note_count())
        check("v1: guids stored exactly as written", sorted(ids) == sorted(m["v1Order"]), sorted(ids))
        deck = deck_named(col, "Import Check")
        check("v1: deck 'Import Check' exists", deck is not None)
        did = deck["id"]
        note(f"deck id in collection: {did}; numeric deck id in the package: {m['packageDeckId']}")
        check("v1: all cards in that deck", col.decks.card_count(did, include_subdecks=False) == 5)
        notetypes = [nt.name for nt in col.models.all_names_and_ids()]
        check("v1: exactly one 'Bible Memorization' note type", notetypes.count("Bible Memorization") == 1, notetypes)
        nt = col.models.by_name("Bible Memorization")
        check("v1: note type kept its fixed id", nt["id"] == m["modelId"], nt["id"])
        check(
            "v1: note type fields in order",
            [f["name"] for f in nt["flds"]] == ["Reference", "Context", "Answer", "Hint", "Info"],
        )
        dues = col.db.all("select n.guid, c.due from cards c join notes n on n.id = c.nid order by c.due")
        note(f"v1 card due values after import: {[d for _, d in dues]}")
        check("v1: new card due order follows NoteSpec.order", [g for g, _ in dues] == m["v1Order"])
        queue = new_queue_guids(col, did)
        check("v1: study queue presents new cards in order", queue == m["v1Order"], queue)
        csums = col.db.list("select csum from notes")
        note(f"csum after import (writer stores 0): {csums}")
        sflds = col.db.list("select sfld from notes order by id")
        check("v1: sort field is Reference", sflds[0] == "John 3:16", sflds)
        mod = col.db.scalar("select mod from notes where guid = ?", m["changedGuid"])
        note(f"note mod after import: {mod} (exportedAt was {m['builds']['v1']['exportedAt']})")

        # Hint rendering.
        card = col.get_card(col.card_ids_of_note(ids[m["v1Order"][1]])[0])
        q = card.question()
        a = card.answer()
        print("\n  -- rendered question (v1, John 3:17) --\n" + q + "\n  -- rendered answer --\n" + a + "\n")
        check("render: {{hint:Hint}} becomes a reveal link", "<a class=hint" in q and "onclick=" in q and ">\nHint</a>" in q)
        check("render: hint text is hidden until clicked", "display: none" in q)
        check("render: context wrapper present", 'class="context"' in q)
        check("render: answer shows after divider", 0 < a.index('<hr id="answer">') < a.index('class="answer"'))
        check("render: info shows on the back only", 'class="info"' in a and 'class="info"' not in q)
        first = col.get_card(col.card_ids_of_note(ids[m["v1Order"][0]])[0])
        check("render: no hint/context markup when fields empty (John 3:16 has no Context)", 'class="context"' not in first.question())

        # Answer the first card Easy so it becomes a review card with an interval.
        studied = col.sched.getCard()
        check("study: first card served is John 3:16", studied.note().guid == m["v1Order"][0], studied.note().guid)
        states = col._backend.get_scheduling_states(studied.id)
        col.sched.answer_card(col.sched.build_answer(card=studied, states=states, rating=CardAnswer.EASY))
        before = col.get_card(studied.id)
        sched_before = (before.type, before.queue, before.due, before.ivl, before.factor, before.reps, before.did)
        note(f"studied card (type, queue, due, ivl, factor, reps, did) = {sched_before}")
        check("study: card now has a review interval", before.ivl >= 1 and before.type == 2, before.ivl)
        changed_nid = ids[m["changedGuid"]]
        check("study: studied card belongs to the note that v2 changes", before.nid == changed_nid)

        # v2.
        import_pkg(col, pkgs["v2"], "v2")
        ids2 = nid_by_guid(col)
        check("v2: note count is 6 (5 kept, 1 added, removed one still present)", col.note_count() == 6, col.note_count())
        check("v2: no duplicate guids", len(ids2) == col.note_count())
        dup_cards = col.db.scalar("select count(*) from (select nid from cards group by nid having count(*) > 1)")
        check("v2: still one card per note", dup_cards == 0 and col.card_count() == 6, col.card_count())
        check("v2: changed note kept its id", ids2[m["changedGuid"]] == changed_nid)
        changed = col.get_note(changed_nid)
        check("v2: changed note has new Answer", changed["Answer"] == m["changedAnswer"], changed["Answer"][:60])
        note(f"changed note tags after v2: {changed.tags}")
        check("v2: changed note has the r2 tag", m["revisionTag"]["v2"] in changed.tags)
        check("v2: changed note's r1 tag replaced (not merged)", m["revisionTag"]["v1"] not in changed.tags, changed.tags)
        note(f"changed note mod after v2: {changed.mod} (v2 exportedAt {m['builds']['v2']['exportedAt']})")
        after = col.get_card(studied.id)
        sched_after = (after.type, after.queue, after.due, after.ivl, after.factor, after.reps, after.did)
        check("v2: studied card kept its scheduling", sched_after == sched_before, sched_after)
        revlog = col.db.scalar("select count(*) from revlog where cid = ?", studied.id)
        check("v2: review history kept", revlog == 1, revlog)
        unchanged_ids = all(ids2[g] == ids[g] for g in m["v1Order"])
        check("v2: every v1 note kept its id", unchanged_ids)
        check("v2: added note arrived", m["addedGuid"] in ids2)
        added_card = col.get_card(col.card_ids_of_note(ids2[m["addedGuid"]])[0])
        check("v2: added note's card is in the deck", added_card.did == did, added_card.did)
        check("v2: added card is new", added_card.type == 0 and added_card.queue == 0)
        removed = col.get_note(ids2[m["removedGuid"]])
        check("v2: removed note still present", removed is not None)
        check("v2: removed note still has only the r1 tag", removed.tags == [m["revisionTag"]["v1"]], removed.tags)
        dues2 = col.db.all(
            "select n.guid, c.due from cards c join notes n on n.id = c.nid where c.type = 0 order by c.due"
        )
        note(f"new-card due values after v2: {[(g.split(':')[3], d) for g, d in dues2]}")
        queue2 = new_queue_guids(col, did)
        note(f"study queue after v2: {[g.split(':')[3] for g in queue2]}")
        due_of = dict(dues2)
        check("v2: added card's due is its v2 order (2)", due_of[m["addedGuid"]] == 2, due_of[m["addedGuid"]])
        moved = m["v2Order"][3]  # John 3:18: due 2 in v1, order 3 in v2
        # Anki never touches existing cards on import (not even with with_scheduling=True), so an
        # existing new card keeps the due it got from v1 even if its position changed in v2.
        known(
            "v2: existing new card's due is moved to its v2 order (John 3:18 -> 3)",
            due_of[moved] == 3,
            f"due is {due_of[moved]}",
        )
        want = [g for g in m["v2Order"] if g != m["changedGuid"]]
        known(
            "v2: new cards are studied in v2 order (17, 21, 18, 20; removed 19 ignored)",
            [g for g in queue2 if g != m["removedGuid"]] == want,
            [g.split(":")[3] for g in queue2],
        )
        check("v2: removed note's card is still in the study queue", m["removedGuid"] in queue2)

        # Cleanup search.
        d = m["deckId"]
        r = m["revisionTag"]["v2"]
        candidates = [
            f"tag:bm::{d}::* -tag:{r}",
            f'"tag:bm::{d}::*" -"tag:{r}"',
            f"tag:bm::{d} -tag:{r}",
        ]
        for search in candidates:
            try:
                found = list(col.find_notes(search))
            except Exception as e:  # noqa: BLE001
                note(f"search {search!r} raised {e}")
                continue
            check(f"cleanup search {search!r} finds exactly the removed note", found == [ids2[m["removedGuid"]]], found)
        everything = list(col.find_notes(f"tag:bm::{d}::*"))
        check("deck tag search finds every note of the deck", len(everything) == 6, len(everything))
        check("revision tag search finds the 5 current notes", len(col.find_notes(f"tag:{r}")) == 5)

        # Re-importing the same package changes nothing.
        log = import_pkg(col, pkgs["v2"], "v2 again")
        check("v2 again: no new or updated notes", len(log.new) == 0 and len(log.updated) == 0)
        check("v2 again: note count unchanged", col.note_count() == 6)
        notetypes = [nt.name for nt in col.models.all_names_and_ids()]
        check("v2: still exactly one 'Bible Memorization' note type", notetypes.count("Bible Memorization") == 1, notetypes)

        # A later TEMPLATE_VERSION (newer note type mod) replaces the template in place.
        import_pkg(col, pkgs["templateBump"], "template bump")
        col.models._clear_cache()  # the Python wrapper caches note types; the importer bypasses it
        nt = col.models.by_name("Bible Memorization")
        note(f"note type mod after template bump: {nt['mod']}")
        check("template bump: note type CSS replaced", m["templateMarker"] in nt["css"])
        check("template bump: same note type id", nt["id"] == m["modelId"])
        notetypes = [x.name for x in col.models.all_names_and_ids()]
        check("template bump: no second note type", notetypes.count("Bible Memorization") == 1, notetypes)
        check("template bump: note count unchanged", col.note_count() == 6)
        again = col.get_card(studied.id)
        check(
            "template bump: studied card kept its scheduling",
            (again.type, again.queue, again.due, again.ivl, again.factor, again.reps, again.did) == sched_before,
        )
    finally:
        col.close()


def scenario_rename(pkgs: dict, m: dict, tmp: Path) -> None:
    print("\n== Scenario 2: deck renamed between v1 and v2 (same deck id) ==")
    col = Collection(str(tmp / "rename.anki2"))
    try:
        import_pkg(col, pkgs["v1"], "v1")
        import_pkg(col, pkgs["v2Renamed"], "v2 renamed")
        names = sorted(d.name for d in col.decks.all_names_and_ids())
        note(f"decks after import: {names}")
        old = deck_named(col, "Import Check")
        new = deck_named(col, "Import Check Renamed")
        ids = nid_by_guid(col)
        where = {
            g.split(":")[3]: col.decks.name(col.get_card(col.card_ids_of_note(i)[0]).did) for g, i in ids.items()
        }
        note(f"deck of each card: {where}")
        check("rename: note count is 6, no duplicates", col.note_count() == 6 and len(ids) == 6)
        check("rename: old deck still exists", old is not None)
        check("rename: a deck with the new name was created", new is not None)
        kept = [where[g.split(":")[3]] for g in m["v1Order"]]
        check("rename: existing cards stay in the old deck", all(k == "Import Check" for k in kept), kept)
        added = where[m["addedGuid"].split(":")[3]]
        note(f"rename: the added note's card went to {added!r}")
        changed = col.get_note(ids[m["changedGuid"]])
        check("rename: notes still updated in place", changed["Answer"] == m["changedAnswer"])
        if old is not None:
            note(f"old deck id {old['id']}; new deck id {new['id'] if new else None}")
    finally:
        col.close()


def scenario_collide(pkgs: dict, m: dict, tmp: Path) -> None:
    print("\n== Scenario 3: different decks whose package note/card ids collide ==")
    col = Collection(str(tmp / "collide.anki2"))
    try:
        import_pkg(col, pkgs["collideA"], "collideA")
        import_pkg(col, pkgs["collideB"], "collideB")
        rows = col.db.all("select id, guid from notes")
        note(f"notes: {rows}")
        check("collide: both notes imported", col.note_count() == 2 and col.card_count() == 2)
        check("collide: ids remapped to be unique", len({r[0] for r in rows}) == 2)
        check(
            "collide: each card in its own deck",
            sorted(col.decks.name(col.get_card(c).did) for c in col.find_cards("")) == ["Collide A", "Collide B"],
        )
    finally:
        col.close()


def main() -> int:
    print(f"Anki {anki_version}")
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        subprocess.run(["npx", "tsx", "scripts/make-test-apkg.ts", str(tmp / "pkg")], cwd=ROOT, check=True)
        m = json.loads((tmp / "pkg" / "manifest.json").read_text())
        pkgs = m["packages"]
        scenario_update(pkgs, m, tmp)
        scenario_rename(pkgs, m, tmp)
        scenario_collide(pkgs, m, tmp)
    failed = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed (Anki {anki_version})")
    for _, name, detail in failed:
        print(f"  FAIL  {name}  [{detail}]")
    for ok, name, detail in limits:
        print(f"  {'UNEXPECTED-PASS' if ok else 'KNOWN-LIMIT'}  {name}  [{detail}]")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
