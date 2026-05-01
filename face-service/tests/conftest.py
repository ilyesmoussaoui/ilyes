"""
Shared pytest fixtures.

Adds the project root to ``sys.path`` so tests can simply
``from app.services import edge_cases``.
"""

from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
