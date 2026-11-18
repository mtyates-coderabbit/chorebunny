import socket
from unittest.mock import Mock

import pytest
import requests
from urllib3.exceptions import NewConnectionError

from app.push_transport import PushSession, _PublicHTTPSConnection


@pytest.mark.parametrize("ip", ["127.0.0.1", "10.1.2.3", "169.254.169.254", "::1", "fc00::1", "::ffff:127.0.0.1"])
def test_private_dns_never_opens_a_socket(monkeypatch, ip):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **kw: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 443))])
    create = Mock()
    monkeypatch.setattr(socket, "socket", create)
    with pytest.raises(NewConnectionError):
        _PublicHTTPSConnection("fcm.googleapis.com", timeout=10)._new_conn()
    create.assert_not_called()


def test_connect_uses_checked_ip_without_second_dns_lookup(monkeypatch):
    resolve = Mock(return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443))])
    monkeypatch.setattr(socket, "getaddrinfo", resolve)
    sock = Mock()
    monkeypatch.setattr(socket, "socket", Mock(return_value=sock))
    connection = _PublicHTTPSConnection("fcm.googleapis.com", timeout=10)
    assert connection._new_conn() is sock
    sock.connect.assert_called_once_with(("8.8.8.8", 443))
    resolve.assert_called_once()
    assert connection.host == "fcm.googleapis.com"


def test_redirect_is_not_followed(monkeypatch):
    calls = []
    def send(self, request, **kwargs):
        calls.append(request.url)
        response = requests.Response()
        response.request = request
        response.status_code = 307
        response.headers["Location"] = "http://169.254.169.254/latest/meta-data/"
        response._content = b""
        return response
    monkeypatch.setattr(requests.adapters.HTTPAdapter, "send", send)
    with PushSession() as session, pytest.raises(requests.RequestException):
        session.post("https://fcm.googleapis.com/test", timeout=10)
    assert calls == ["https://fcm.googleapis.com/test"]


def test_real_webpush_uses_public_address_guard(monkeypatch):
    import base64
    from pywebpush import webpush
    from tests.push_helpers import AUTH, KEY

    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **kw: [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("169.254.169.254", 443)),
    ])
    create = Mock()
    monkeypatch.setattr(socket, "socket", create)
    private_key = base64.urlsafe_b64encode((3).to_bytes(32, "big")).decode().rstrip("=")
    with PushSession() as session, pytest.raises(requests.ConnectionError):
        webpush(subscription_info={"endpoint": "https://fcm.googleapis.com/test", "keys": {"p256dh": KEY, "auth": AUTH}},
                data="test", vapid_private_key=private_key,
                vapid_claims={"sub": "mailto:test@example.com"}, requests_session=session, timeout=10)
    create.assert_not_called()
