"""Synthetic valid Web Push encryption material for subscription tests."""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def push_key(number: int = 1) -> str:
    """Return a deterministic synthetic P-256 public key."""
    raw = ec.derive_private_key(number, ec.SECP256R1()).public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint,
    )
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


AUTH = base64.urlsafe_b64encode(b"synthetic-secret").decode().rstrip("=")
KEY = push_key()
