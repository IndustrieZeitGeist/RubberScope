import argparse
import os
import socket
import sys
import traceback
import webbrowser
from pathlib import Path
from threading import Timer


def main():
    parser = argparse.ArgumentParser(description="RubberScope lokal starten")
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    os.chdir(Path(__file__).resolve().parent)
    local_python = Path(".venv/Scripts/python.exe").resolve()
    if os.name == "nt" and local_python.exists() and sys.prefix == sys.base_prefix:
        import subprocess

        return subprocess.call([str(local_python), str(Path(__file__).resolve()), *sys.argv[1:]])
    import uvicorn

    class LocalServer(uvicorn.Server):
        async def startup(self, sockets=None):
            await super().startup(sockets=sockets)
            if self.started:
                print(f"Server bereit: {url}", flush=True)
            if self.started and not args.no_browser:
                browser = Timer(0, webbrowser.open, args=(url,))
                browser.daemon = True
                browser.start()

    with socket.socket() as listener:
        if os.name == "nt":
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            listener.bind(("127.0.0.1", 8000))
        except OSError:
            listener.bind(("127.0.0.1", 0))
        url = f"http://127.0.0.1:{listener.getsockname()[1]}"
        print(f"RubberScope: {url} (Beenden mit Strg+C)", flush=True)
        server = LocalServer(uvicorn.Config("app.main:app"))
        server.run(sockets=[listener])
        return 0 if server.started else 1


if __name__ == "__main__":
    try:
        exit_code = main()
    except (Exception, SystemExit) as exc:
        if isinstance(exc, SystemExit) and exc.code == 0:
            raise
        traceback.print_exc()
        exit_code = 1
    if exit_code and sys.stdin is not None and sys.stdin.isatty():
        try:
            input("Start fehlgeschlagen. Installation in README.md prüfen. Eingabetaste zum Schließen.")
        except EOFError:
            pass
    sys.exit(exit_code)


