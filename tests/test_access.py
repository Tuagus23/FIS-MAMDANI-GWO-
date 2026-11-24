import json
import runpy
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import access
from auth import AuthDenied, AuthForbidden, AuthKicked, AuthProviderUnavailable, verify_authorization_header

ADMIN_ID = "813dc01f-c17c-4540-9138-9cec2c799408"
MEMBER_ID = "0fee4301-351b-417a-961c-600c146bb817"
ADMIN = {"id": ADMIN_ID, "name": "Admin", "role": "super_admin"}
MEMBER = {"id": MEMBER_ID, "name": "Pengguna", "role": "member"}
VERSION = "2026-11-25T01:00:00+00:00"


class AccessTests(unittest.TestCase):
    def test_void_rpc_response_is_successful(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self): return b""
        with patch.object(access, "_settings", return_value=("https://example.org", "key", set())), \
             patch.object(access, "urlopen", return_value=Response()):
            self.assertIsNone(access._request("rpc/dashboard_end_session", "token", {}))

    def test_member_cannot_list_or_update_even_with_forged_payload(self):
        with patch.object(access, "_request") as provider:
            for operation in [lambda: access.list_users(MEMBER, "token"),
                              lambda: access.update_user(MEMBER, "token", {"role": "super_admin"})]:
                with self.assertRaises(AuthForbidden):
                    operation()
            provider.assert_not_called()

    def test_revoked_or_missing_identity_is_denied(self):
        for rows in [{"state": "access_revoked"}, {"id": MEMBER_ID, "active": False, "role": "member"}]:
            with patch.object(access, "_request", return_value=rows), self.assertRaises(AuthForbidden):
                access.read_identity(MEMBER_ID, "token")

    def test_kicked_session_is_distinct_from_expired_or_missing_state(self):
        for profile, exception in [({"state": "kicked"}, AuthKicked), ({"state": "expired"}, AuthDenied), ([], AuthProviderUnavailable)]:
            with patch.object(access, "_request", return_value=profile), self.assertRaises(exception):
                access.read_identity(MEMBER_ID, "token")

    def test_forged_identity_cannot_reuse_another_users_profile(self):
        with patch.object(access, "_request", return_value={"id": ADMIN_ID, "active": True, "role": "super_admin", "state": "open"}), self.assertRaises(AuthDenied):
            access.read_identity(MEMBER_ID, "token")

    def test_member_cannot_kick_even_with_an_admin_target_id(self):
        with patch.object(access, "_request") as provider, self.assertRaises(AuthForbidden):
            access.kick_member(MEMBER, "token", {"id": ADMIN_ID})
        provider.assert_not_called()

    def test_invalid_role_status_or_version_never_reaches_database(self):
        valid = {"id": MEMBER_ID, "role": "member", "active": True, "updated_at": VERSION}
        for change in [{"role": []}, {"role": "owner"}, {"active": "true"}, {"updated_at": "invalid timestamp"}, {"id": "bad"}]:
            with patch.object(access, "_request") as provider, self.assertRaises(ValueError):
                access.update_user(ADMIN, "token", {**valid, **change})
            provider.assert_not_called()

    def test_update_forwards_actor_token_and_version_to_guarded_rpc(self):
        with patch.object(access, "_request") as provider:
            access.update_user(ADMIN, "actor-token", {"id": MEMBER_ID, "role": "member", "active": False, "updated_at": VERSION})
            provider.assert_called_once_with("rpc/dashboard_update_user", "actor-token", {
                "target_user_id": MEMBER_ID, "new_role": "member", "new_active": False, "expected_updated_at": VERSION})

    def test_database_role_overrides_env_and_editable_metadata(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self): return json.dumps({"id": ADMIN_ID, "email": "test@example.org", "user_metadata": {"role": "super_admin"}}).encode()
        with patch("auth._settings", return_value=("https://example.org", "key", {"test@example.org"})), \
             patch("auth._login_directory", return_value=({}, set(), {"test@example.org": {"name": "Test", "role": "super_admin"}})), \
             patch("auth.urlopen", return_value=Response()), \
             patch.object(access, "read_identity", return_value={"id": ADMIN_ID, "role": "member", "active": True}):
            self.assertEqual(verify_authorization_header("Bearer " + "x" * 40)["role"], "member")


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.namespace = runpy.run_path(str(Path(__file__).resolve().parents[1] / "api" / "[...path].py"))
        cls.handler = cls.namespace["handler"]
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), cls.handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def request(self, path, payload=None):
        request = Request(f"http://127.0.0.1:{self.server.server_port}{path}",
                          data=None if payload is None else json.dumps(payload).encode(),
                          headers={"Authorization": "Bearer " + "x" * 40, "Content-Type": "application/json"})
        try:
            with urlopen(request) as response: return response.status, json.loads(response.read())
        except HTTPError as error:
            with error:
                return error.code, json.loads(error.read())

    def test_member_admin_routes_return_403_without_revoking_session(self):
        with patch.dict(self.handler.do_GET.__globals__, verify_authorization_header=lambda _: MEMBER):
            for payload in [None, {"id": ADMIN_ID, "role": "super_admin"}]:
                status, body = self.request("/api/admin-users", payload)
                self.assertEqual((status, body["code"]), (403, "admin_required"))
            status, body = self.request("/api/datasets")
            self.assertEqual(status, 200)
            self.assertEqual(body["identity"]["role"], "member")

    def test_member_can_still_simulate(self):
        with patch.dict(self.handler.do_GET.__globals__, verify_authorization_header=lambda _: MEMBER,
                        run_simulation=lambda payload: {"config": payload, "summary": []}):
            self.assertEqual(self.request("/api/simulate", {"nodes": 10})[0], 200)

    def test_bootstrap_returns_verified_identity_and_default_dataset_together(self):
        snapshot = {"dataset": {"id": "results"}, "summary": [], "history": []}
        with patch.dict(self.handler.do_GET.__globals__, verify_authorization_header=lambda _: MEMBER,
                        dashboard_data=lambda key: snapshot if key == "results" else self.fail("Wrong dataset")):
            status, body = self.request("/api/bootstrap")
            self.assertEqual(status, 200)
            self.assertEqual(body["identity"]["id"], MEMBER_ID)
            self.assertEqual(body["data"], snapshot)

    def test_bootstrap_never_reads_data_for_a_kicked_session(self):
        def kicked(_): raise AuthKicked("Sesi dikeluarkan.")
        with patch.dict(self.handler.do_GET.__globals__, verify_authorization_header=kicked,
                        dashboard_data=lambda _: self.fail("Unauthorized data read")):
            status, body = self.request("/api/bootstrap")
            self.assertEqual((status, body["code"]), (401, "session_kicked"))

    def test_revoked_identity_does_not_reach_simulation(self):
        def denied(_): raise AuthForbidden("Akses dinonaktifkan.")
        with patch.dict(self.handler.do_GET.__globals__, verify_authorization_header=denied), \
             patch.dict(self.handler.do_GET.__globals__, run_simulation=lambda _: self.fail("Simulation reached")):
            status, body = self.request("/api/simulate", {"nodes": 10})
            self.assertEqual((status, body["code"]), (403, "access_revoked"))

    def test_anonymous_admin_request_requires_session(self):
        def denied(_): raise AuthDenied("Sesi tidak berlaku.")
        with patch.dict(self.handler.do_GET.__globals__, verify_authorization_header=denied):
            self.assertEqual(self.request("/api/admin-users")[0], 401)

    def test_member_cannot_call_kick_endpoint(self):
        with patch.dict(self.handler.do_GET.__globals__, verify_authorization_header=lambda _: MEMBER):
            self.assertEqual(self.request("/api/admin-kick", {"id": ADMIN_ID})[0], 403)

    def test_kicked_session_returns_sticker_error_on_every_protected_route(self):
        def kicked(_): raise AuthKicked("Sesi dikeluarkan.")
        with patch.dict(self.handler.do_GET.__globals__, verify_authorization_header=kicked):
            for route, payload in [("/api/session", None), ("/api/datasets", None), ("/api/simulate", {"nodes": 10})]:
                status, body = self.request(route, payload)
                self.assertEqual((status, body["code"]), (401, "session_kicked"))


if __name__ == "__main__":
    unittest.main()
