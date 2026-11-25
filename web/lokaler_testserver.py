"""Lokaler Testserver: liefert die Web-App aus und beantwortet /api/<funktion> mit dem echten
Python-Rechenkern (natives Python statt Pyodide). Nur für Tests, nicht Teil der Webseite."""
import base64
import json
import sys
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP = Path(sys.argv[1]).resolve()
import importlib.util, types
for name in ('rubberscope_engine', 'rubberscope_berichte', 'web_api'):
    spec = importlib.util.spec_from_loader(name, loader=None)
    mod = types.ModuleType(name); mod.__file__ = str(APP / 'py' / (name + '.py.txt'))
    sys.modules[name] = mod
    exec(compile((APP / 'py' / (name + '.py.txt')).read_text(encoding='utf-8'), mod.__file__, 'exec'), mod.__dict__)
api = sys.modules['web_api']


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(APP), **k)

    def log_message(self, *a):
        pass

    def do_POST(self):
        if not self.path.startswith('/api/'):
            return self.send_error(404)
        fn = self.path[5:]
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        args = [base64.b64decode(a['__b64']) if isinstance(a, dict) and '__b64' in a else a for a in body['args']]
        try:
            res = getattr(api, fn)(*args)
            if isinstance(res, (bytes, bytearray, memoryview)):
                data, ctype = bytes(res), 'application/octet-stream'
            else:
                data, ctype = json.dumps({'v': res}).encode(), 'application/json'
            self.send_response(200)
        except Exception as e:
            data, ctype = json.dumps({'error': f'{type(e).__name__}: {e}', 'tb': traceback.format_exc()}).encode(), 'application/json'
            self.send_response(500)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2]) if len(sys.argv) > 2 else 8765), H).serve_forever()
