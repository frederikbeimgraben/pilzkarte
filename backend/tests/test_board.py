"""Das Brett und die Seite mit dem Entitätendiagramm."""

import json
import threading
from collections.abc import Iterator
from http.client import HTTPConnection, HTTPResponse
from http.server import ThreadingHTTPServer
from pathlib import Path

import board
import pytest


@pytest.fixture(name="client")
def fixture_client() -> Iterator[HTTPConnection]:
    """Das Brett auf einem freien Port, so wie es auch im Tunnel läuft."""
    service = ThreadingHTTPServer(("127.0.0.1", 0), board.Griff)
    threading.Thread(target=service.serve_forever, daemon=True).start()
    connection = HTTPConnection("127.0.0.1", service.server_port)
    yield connection
    connection.close()
    service.shutdown()
    service.server_close()


def get(client: HTTPConnection, path: str) -> HTTPResponse:
    client.request("GET", path)
    return client.getresponse()


def test_the_board_itself_still_answers(client: HTTPConnection) -> None:
    answer = get(client, "/")
    body = answer.read()

    assert answer.status == 200
    assert b"Pilzkarte" in body


def test_the_board_links_to_the_diagram(client: HTTPConnection) -> None:
    body = get(client, "/").read()

    assert b'href="/erd"' in body


def test_the_diagram_page_takes_mermaid_from_the_board(client: HTTPConnection) -> None:
    # Der Rechner hängt nicht immer am Netz. Ein fremder Server würde die
    # Seite dann leer lassen.
    answer = get(client, "/erd")
    body = answer.read()

    assert answer.status == 200
    assert b'src="/erd/mermaid.min.js"' in body


def test_mermaid_lies_next_to_the_board(client: HTTPConnection) -> None:
    answer = get(client, "/erd/mermaid.min.js")
    body = answer.read()

    assert answer.status == 200
    assert answer.headers.get("Content-Type") == "text/javascript; charset=utf-8"
    assert b"mermaid" in body


def test_the_diagram_comes_from_the_file_of_the_repository(client: HTTPConnection) -> None:
    answer = get(client, "/erd.mmd")
    body = answer.read()

    assert answer.status == 200
    assert body.decode() == board.DIAGRAM.read_text(encoding="utf-8")
    assert body.startswith(b"erDiagram")


def test_a_missing_diagram_is_not_a_broken_page(
    client: HTTPConnection,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(board, "DIAGRAM", tmp_path / "erd.mmd")

    answer = get(client, "/erd.mmd")
    body = json.loads(answer.read())

    assert answer.status == 404
    assert body == {"fehler": "erd.mmd fehlt"}


def test_an_unknown_path_stays_unknown(client: HTTPConnection) -> None:
    answer = get(client, "/erd/gibt-es-nicht")
    answer.read()

    assert answer.status == 404
