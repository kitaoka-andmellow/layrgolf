import importlib.util
import pathlib
import unittest

MODULE = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "sync_ichiba_affiliate.py"
SPEC = importlib.util.spec_from_file_location("affiliate", str(MODULE))
aff = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(aff)


class AffiliateTest(unittest.TestCase):
    def sample(self):
        return {
            "itemName": "ゴルフ用グローブ",
            "itemCode": "shop:001",
            "itemPrice": 3200,
            "affiliateUrl": "https://hb.afl.rakuten.co.jp/hgc/example/",
            "mediumImageUrls": [{"imageUrl": "https://thumbnail.image.rakuten.co.jp/123.jpg"}],
            "availability": 1,
            "reviewAverage": 4.4,
            "reviewCount": 100,
        }

    def test_picks_verified_affiliate_url_and_image(self):
        rows = aff.parse_items({"items": [self.sample()]})
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["target_url"], "https://hb.afl.rakuten.co.jp/hgc/example/")
        self.assertEqual(rows[0]["item_price_yen"], 3200)
        self.assertTrue(rows[0]["item_image_url"].startswith("https://"))

    def test_no_affiliate_url_means_no_published_link(self):
        item = self.sample()
        item.pop("affiliateUrl")
        self.assertEqual(aff.parse_items({"Items": [{"Item": item}]}), [])

    def test_rejects_out_of_stock_or_non_https(self):
        item = self.sample()
        item["availability"] = 0
        self.assertEqual(aff.parse_items({"items": [item]}), [])
        item["availability"] = 1
        item["affiliateUrl"] = "javascript:alert(1)"
        self.assertEqual(aff.parse_items({"items": [item]}), [])

    def test_stable_product_assignment(self):
        rows = [{"item_code": "a"}, {"item_code": "b"}]
        self.assertEqual(aff.product_for(rows, 90107, "detail_accessory_glove"),
                         aff.product_for(rows, 90107, "detail_accessory_glove"))


if __name__ == "__main__":
    unittest.main()
