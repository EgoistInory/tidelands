"""Local-only static server with uncached development assets."""
from functools import partial
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='潮生群岛本地预览')
    parser.add_argument('--port', type=int, default=4190, help='本地端口，默认4190；0表示自动分配')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('端口必须在0到65535之间')
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(Path(__file__).parent)))
    except OSError as error:
        parser.error(f'无法启动本地服务：{error.strerror}。可用 --port 4191 选择其他端口。')
    print(f'潮生群岛：http://127.0.0.1:{server.server_address[1]}', flush=True)
    server.serve_forever()
