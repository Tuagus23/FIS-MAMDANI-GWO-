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
from auth import AuthDenied, AuthForbidden, verify_authorization_header

ADMIN_ID = "813dc01f-c17c-4540-9138-9cec2c799408"
MEMBER_ID = "0fee4301-351b-417a-961c-600c146bb817"
ADMIN = {"id": ADMIN_ID, "name": "Admin", "role": "super_admin"}
MEMBER = {"id": MEMBER_ID, "name": "Pengguna", "role": "member"}
VERSION = "2026-11-25T01:00:00+00:00"


class AccessTests(unittest.TestCase):
    def test_member_cannot_list_or_update_even_with_forged_payload(self):
        with patch.object(access, "_request") as provider:
            for operation in [lambda: access.list_users(MEMBER, "token"),
                              lambda: access.update_user(MEMBER, "token", {"role": "super_admin"})]:
                with self.assertRaises(AuthForbidden):
                    operation()
            provider.assert_not_called()

    def test_revoked_or_missing_identity_is_denied(self):
        for rows in [[], [{"id": MEMBER_ID, "active": False, "role": "member"}]]:
            with patch.object(access, "_request", return_value=rows), self.assertRaises(AuthForbidden):
                access.read_identity(MEMBER_ID, "token")

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
                status, body = self.request("/api/admin/users", payload)
                self.assertEqual((status, body["code"]), (403, "admin_required"))
            status, body = self.request("/api/datasets")
            self.assertEqual(status, 200)
            self.assertEqual(body["identity"]["role"], "member")

    def test_member_can_still_simulate(self):
        with patch.dict(self.handler.do_GET.__globals__, verify_authorization_header=lambda _: MEMBER,
                        run_simulation=lambda payload: {"config": payload, "summary": []}):
            self.assertEqual(self.request("/api/simulate", {"nodes": 10})[0], 200)

    def test_revoked_identity_does_not_reach_simulation(self):
        def denied(_): raise AuthForbidden("Akses dinonaktifkan.")
        with patch.dict(self.handler.do_GET.__globals__, verify_authorization_header=denied), \
             patch.dict(self.handler.do_GET.__globals__, run_simulation=lambda _: self.fail("Simulation reached")):
            status, body = self.request("/api/simulate", {"nodes": 10})
            self.assertEqual((status, body["code"]), (403, "access_revoked"))

    def test_anonymous_admin_request_requires_session(self):
        def denied(_): raise AuthDenied("Sesi tidak berlaku.")
        with patch.dict(self.handler.do_GET.__globals__, verify_authorization_header=denied):
            self.assertEqual(self.request("/api/admin/users")[0], 401)


if __name__ == "__main__":
    unittest.main()
