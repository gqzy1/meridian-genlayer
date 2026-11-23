from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch
import os
import sys
import unittest

runtime = ModuleType("genlayer")
runtime.allow_storage = lambda cls: cls
runtime.i32 = runtime.u8 = runtime.u64 = int
runtime.TreeMap = dict
runtime.DynArray = list
runtime.gl = SimpleNamespace(
    Contract=object,
    vm=SimpleNamespace(UserError=ValueError),
    public=SimpleNamespace(write=lambda method: method, view=lambda method: method),
)
sys.modules["genlayer"] = runtime
spec = spec_from_file_location("meridian", Path(__file__).resolve().parents[1] / "contracts/meridian_adjudicator.py")
contract = module_from_spec(spec)
sys.modules[spec.name] = contract
spec.loader.exec_module(contract)
OLD = "https://www.rfc-editor.org/rfc/rfc7231.txt"
NEW = "https://www.rfc-editor.org/rfc/rfc9110.txt"
CLAIM = "As of 2022-06; sections 4.2.1 / 9.2.1; The document defines GET as a safe method."
QUOTE = "This is the actual sentence in the selected section."


def doc(rfc, month, obsoletes=None, section="9.2.1"):
    return {"rfc": rfc, "status": "REACHABLE", "month": month,
            "obsoletes": obsoletes or [], "section": section,
            "digest": rfc * 16, "body": QUOTE}


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.older = doc("7231", "2014-06", section="4.2.1")
        self.newer = doc("9110", "2022-06", ["7231"])

    def test_revision_switches_at_publication(self):
        self.assertEqual(contract._select_document(self.older, self.newer, "2022-05")[0]["rfc"], "7231")
        self.assertEqual(contract._select_document(self.older, self.newer, "2022-06")[0]["rfc"], "9110")

    def test_unrelated_and_unavailable_sources_fail_closed(self):
        unrelated = {**self.newer, "obsoletes": []}
        inaccessible = {**self.newer, "status": "UNAVAILABLE"}
        self.assertIsNone(contract._select_document(self.older, unrelated, "2022-06")[0])
        self.assertIsNone(contract._select_document(self.older, inaccessible, "2022-06")[0])
        self.assertIsNone(contract._select_document(self.older, None, "2014-05")[0])

    def test_strict_source_and_section(self):
        for url in (OLD + "](https://www.rfc-editor.org", OLD + "?a=b", OLD.replace("www.rfc-editor.org", "example.com")):
            with self.assertRaises(ValueError):
                contract._rfc_id(url)
        with self.assertRaises(ValueError):
            contract._read_criteria(CLAIM, False)

    def test_model_cannot_make_up_quote(self):
        answer = lambda *_a, **_kw: {"verdict": "VERIFIED", "quote": "This is an invented sentence."}
        with patch.object(runtime.gl, "nondet", SimpleNamespace(exec_prompt=answer), create=True):
            with self.assertRaises(ValueError):
                contract._classify("statement", QUOTE)

    def test_leader_cannot_extend_a_true_quote_with_invented_text(self):
        with patch.object(contract, "_read_document", side_effect=[self.older, self.newer]):
            with self.assertRaises(ValueError):
                contract._observe(CLAIM, OLD, NEW, {"verdict": "VERIFIED", "quote": QUOTE + " Forged.", "start": 0})

    def test_equivalence_binds_version_and_anchored_quote(self):
        profile = {"primary": self.older, "secondary": self.newer, "verdict": "VERIFIED",
                   "quote": QUOTE, "start": 10}
        self.assertTrue(contract._equivalent({**profile, "quote": QUOTE[12:], "start": 22}, profile))
        self.assertFalse(contract._equivalent({**profile, "start": 500}, profile))
        self.assertFalse(contract._equivalent({**profile, "verdict": "REFUTED"}, profile))
        self.assertFalse(contract._equivalent({**profile, "secondary": {**self.newer, "digest": "different"}}, profile))

    def test_missing_section_yields_inconclusive_without_a_model_call(self):
        with patch.object(contract, "_read_document", side_effect=[self.older, {**self.newer, "body": ""}]):
            result = contract._observe(CLAIM, OLD, NEW)
        self.assertEqual((result["verdict"], result["selected"], result["quote"]), ("INCONCLUSIVE", "9110", ""))

    def test_registration_serializes_record_and_counts_active(self):
        registry = contract.MeridianAdjudicator()
        registry.claims, registry.claim_ids, registry.evidence_rounds = {}, [], {}
        address = "0x" + "ab" * 20
        sender = SimpleNamespace(sender_address=SimpleNamespace(as_hex=address))
        with patch.object(runtime.gl, "message", sender, create=True):
            claim_id = registry.submit_claim("GET is safe", "PROTOCOL", "Zurich", 473769, 85417, CLAIM, OLD, NEW)
        first = registry.get_claim(claim_id)
        self.assertEqual(claim_id, "MRD-001")
        self.assertEqual(registry.list_claims(), [first])
        self.assertEqual((first["status"], first["submitter"], first["lat_e4"]), ("ACTIVE", address, 473769))
        self.assertEqual(registry.get_stats(), {
            "total_claims": 1, "total_adjudications": 0, "active": 1,
            "verified": 0, "refuted": 0, "inconclusive": 0,
        })

    @unittest.skipUnless(os.environ.get("MERIDIAN_RFC_SOURCES"), "RFC Editor source files not provided")
    def test_rfc_editor_documents(self):
        root = Path(os.environ["MERIDIAN_RFC_SOURCES"])
        def request(url, **_):
            return SimpleNamespace(status=200, body=(root / url.rsplit("/", 1)[1]).read_bytes())
        with patch.object(runtime.gl, "nondet", SimpleNamespace(web=SimpleNamespace(request=request)), create=True):
            old, new = contract._read_document(OLD, "4.2.1"), contract._read_document(NEW, "9.2.1")
        self.assertEqual((old["month"], new["month"]), ("2014-06", "2022-06"))
        self.assertIn("7231", new["obsoletes"])
        for record in (old, new):
            self.assertIn("GET, HEAD, OPTIONS, and TRACE", record["body"])
            self.assertEqual(len(record["digest"]), 64)
