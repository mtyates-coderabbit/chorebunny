"""Restrict push delivery to public addresses of supported push providers."""

import ipaddress
import socket
from urllib.parse import urlsplit

import requests
from requests.adapters import HTTPAdapter
from urllib3.connection import HTTPSConnection
from urllib3.connectionpool import HTTPSConnectionPool
from urllib3.exceptions import NewConnectionError

PUSH_HOSTS = {"fcm.googleapis.com", "updates.push.services.mozilla.com"}


def validate_push_endpoint(endpoint: str) -> str:
    """Require an HTTPS endpoint on a supported browser push service."""
    parsed = urlsplit(endpoint)
    host = parsed.hostname or ""
    if (parsed.scheme != "https" or parsed.username is not None
            or parsed.password is not None or parsed.port not in (None, 443)
            or parsed.fragment or any(c.isspace() or c == "\\" for c in endpoint)
            or not (host in PUSH_HOSTS or host == "web.push.apple.com"
                    or host.endswith(".push.apple.com"))):
        raise ValueError("Unsupported push-service endpoint")
    return endpoint


class _PublicHTTPSConnection(HTTPSConnection):
    """Connect to a checked public IP while retaining the provider TLS hostname."""

    def _new_conn(self) -> socket.socket:
        try:
            addresses = socket.getaddrinfo(self.host, self.port, type=socket.SOCK_STREAM)
            if not addresses or any(
                not ipaddress.ip_address(address[4][0]).is_global
                or (getattr(ipaddress.ip_address(address[4][0]), "ipv4_mapped", None) is not None
                    and not ipaddress.ip_address(address[4][0]).ipv4_mapped.is_global)
                for address in addresses
            ):
                raise ValueError("Push endpoint resolved to a non-public address")
            family, socktype, proto, _, sockaddr = addresses[0]
            sock = socket.socket(family, socktype, proto)
            try:
                sock.settimeout(self.timeout)
                for option in self.socket_options or []:
                    sock.setsockopt(*option)
                sock.connect(sockaddr)
                return sock
            except BaseException:
                sock.close()
                raise
        except (OSError, ValueError) as exc:
            raise NewConnectionError(self, "Cannot connect to public push endpoint") from exc


class _PublicHTTPSPool(HTTPSConnectionPool):
    ConnectionCls = _PublicHTTPSConnection


class _PushAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs) -> None:
        super().init_poolmanager(*args, **kwargs)
        self.poolmanager.pool_classes_by_scheme = {"https": _PublicHTTPSPool}

    def send(self, request, **kwargs):
        validate_push_endpoint(request.url)
        return super().send(request, **kwargs)


class PushSession(requests.Session):
    """Send push requests without proxies or redirects through checked connections."""

    def __init__(self) -> None:
        super().__init__()
        self.trust_env = False
        self.mount("https://", _PushAdapter(max_retries=0))

    def post(self, url, **kwargs):
        """Reject redirects rather than forwarding a subscription to another origin."""
        kwargs["allow_redirects"] = False
        response = super().post(url, **kwargs)
        if 300 <= response.status_code < 400:
            response.close()
            raise requests.RequestException("Push endpoint returned a redirect")
        return response
