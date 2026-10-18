import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('asset_fetch', Path(__file__).resolve().parents[1] / 'tools/fetch_authored_asset.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FreeAssetSelection(unittest.TestCase):
    def page(self, text):
        p = module.Page()
        p.feed(text)
        return p

    def test_rows_do_not_borrow_a_later_filename_or_advertisement(self):
        p = self.page('<meta name="csrf_token" value="anonymous-fixture"><div class="upload" data-min_price="1999"><a data-upload_id="11">Download</a><div>Source.zip</div></div><div class="upload"><a data-upload_id="22">Download</a><strong>Standard.zip</strong></div><aside>Source.zip Standard.zip</aside>')
        self.assertEqual(p.csrf, 'anonymous-fixture')
        self.assertEqual(module.select_free_upload(p, 'Standard.zip')['id'], '22')
        self.assertNotIn('Standard.zip', p.uploads[0]['text'])

    def test_paid_or_ambiguous_standard_is_rejected(self):
        for rows in ['<div class="upload" data-min_price="1999"><a data-upload_id="11"></a>Standard.zip</div>', '<div class="upload"><a data-upload_id="11"></a>Standard.zip</div>' * 2]:
            with self.assertRaises(RuntimeError):
                module.select_free_upload(self.page(rows), 'Standard.zip')

    def test_missing_row_and_non_numeric_id_are_rejected(self):
        for rows in ['<div>Standard.zip</div>', '<div class="upload"><a data-upload_id="../private"></a>Standard.zip</div>']:
            with self.assertRaises(RuntimeError):
                module.select_free_upload(self.page(rows), 'Standard.zip')


if __name__ == '__main__':
    unittest.main()
