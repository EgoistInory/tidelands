"""Fetch only an author's explicitly free Standard archive, anonymously, without executing it."""
import argparse
import hashlib
import http.cookiejar
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
import zipfile
from html.parser import HTMLParser
from pathlib import Path

PACKS = {
    'base': ('universal-base-characters', 'Universal Base Characters[Standard].zip'),
    'animations': ('universal-animation-library', 'Universal Animation Library[Standard].zip'),
}
ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.csrf = None
        self.uploads = []
        self.current = None
        self.div_depth = 0
        self.upload_depth = None

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if data.get('name') == 'csrf_token':
            self.csrf = data.get('value') or data.get('content') or self.csrf
        if tag == 'div':
            self.div_depth += 1
        if tag == 'div' and 'upload' in data.get('class', '').split():
            self.current = {'id': None, 'text': '', 'minimumPrice': data.get('data-min_price', '0')}
            self.upload_depth = self.div_depth
            self.uploads.append(self.current)
        if self.current is not None and 'data-upload_id' in data:
            self.current['id'] = data['data-upload_id']
            self.current['minimumPrice'] = data.get('data-min_price', self.current['minimumPrice'])

    def handle_endtag(self, tag):
        if tag == 'div':
            if self.div_depth == self.upload_depth:
                self.current = None
                self.upload_depth = None
            self.div_depth -= 1

    def handle_data(self, data):
        if self.current is not None:
            self.current['text'] += data


def select_free_upload(page, filename):
    matches = [u for u in page.uploads if filename in u['text']]
    if len(matches) != 1 or matches[0]['minimumPrice'] != '0' or not re.fullmatch(r'\d+', matches[0]['id'] or ''):
        raise RuntimeError('Could not identify a unique zero-price Standard upload; no paid fallback')
    return matches[0]


def fetch(pack):
    slug, filename = PACKS[pack]
    public = 'https://quaternius.itch.io/' + slug
    destination = ROOT / 'dist' / 'authored-source' / filename
    if destination.exists():
        raise RuntimeError('Archive already exists; inspect it instead of downloading again')
    destination.parent.mkdir(parents=True, exist_ok=True)
    system_ca = '/etc/ssl/cert.pem' if Path('/etc/ssl/cert.pem').is_file() else None
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),
                                        urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile=system_ca)))
    opener.addheaders = [('User-Agent', 'Tidelands-local-asset-audit/1.0')]

    def read(url, data=None):
        request = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode() if data is not None else None)
        with opener.open(request, timeout=30) as response:
            return response.read(4 * 1024 * 1024).decode()

    purchase_html = read(public + '/purchase')
    if filename not in purchase_html:
        raise RuntimeError('Free Standard filename is absent from the official purchase page')
    page = Page()
    page.feed(purchase_html)
    if not page.csrf:
        raise RuntimeError('Anonymous request token missing')
    # This is the exact free-download operation used by the author's No thanks link.
    download = json.loads(read(public + '/download_url', {'csrf_token': page.csrf}))
    download_page = Page()
    download_page.feed(read(download['url']))
    upload = select_free_upload(download_page, filename)
    token = download_page.csrf or page.csrf
    request_url = public + '/file/' + upload['id'] + '?source=game_download&as_props=1'
    result = json.loads(read(request_url, {'csrf_token': token}))
    url = result.get('url')
    if not url or urllib.parse.urlparse(url).scheme != 'https':
        raise RuntimeError('Official file operation did not return an HTTPS download')
    temporary = destination.with_suffix('.zip.part')
    if temporary.exists():
        raise RuntimeError('Partial file exists; inspect it before retrying')
    started = time.monotonic()
    with opener.open(url, timeout=30) as response, temporary.open('xb') as output:
        size = 0
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > 160 * 1024 * 1024 or time.monotonic() - started > 180:
                raise RuntimeError('Anonymous asset download exceeded the bounded size/time allowance')
            output.write(chunk)
    if not zipfile.is_zipfile(temporary):
        raise RuntimeError('Downloaded data is not a ZIP archive')
    with zipfile.ZipFile(temporary) as archive:
        entries = [{'name': i.filename, 'bytes': i.file_size} for i in archive.infolist()]
        if len(entries) > 3000 or sum(i['bytes'] for i in entries) > 512 * 1024 * 1024:
            raise RuntimeError('Archive exceeds the bounded inspection allowance')
        if archive.testzip() is not None:
            raise RuntimeError('Archive CRC verification failed')
    temporary.rename(destination)
    report = {'author': 'Quaternius', 'pack': slug, 'edition': 'Standard', 'pricePaid': 0,
              'publicPage': public, 'archive': str(destination.relative_to(ROOT)),
              'bytes': destination.stat().st_size, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
              'uploadId': upload['id'], 'zipCrcVerified': True, 'entries': entries,
              'executedDownloadedCode': False, 'runtimeIntegrated': False,
              'note': 'Anonymous free-author download. Session tokens and expiring URLs are neither printed nor saved. Contents still require license, GLB structure and rendered suitability inspection.'}
    (ROOT / 'docs' / ('authored-' + pack + '-download.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ['pack', 'bytes', 'sha256', 'zipCrcVerified']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('pack', choices=PACKS)
    fetch(parser.parse_args().pack)
