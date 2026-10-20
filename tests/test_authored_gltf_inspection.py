import base64
import importlib.util
import json
import struct
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('gltf_inspect', Path(__file__).resolve().parents[1] / 'tools/inspect_authored_gltf.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    binary = struct.pack('<9f2f6f', 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0)
    return {
        'asset': {'version': '2.0', 'generator': 'local synthetic inspection fixture'},
        'buffers': [{'byteLength': len(binary), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(binary).decode()}],
        'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 36}, {'buffer': 0, 'byteOffset': 36, 'byteLength': 8}, {'buffer': 0, 'byteOffset': 44, 'byteLength': 24}],
        'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 3, 'type': 'VEC3'}, {'bufferView': 1, 'componentType': 5126, 'count': 2, 'type': 'SCALAR'}, {'bufferView': 2, 'componentType': 5126, 'count': 2, 'type': 'VEC3'}],
        'meshes': [{'name': 'synthetic triangle', 'primitives': [{'attributes': {'POSITION': 0}}]}],
        'nodes': [{'name': 'Hip', 'children': [1]}, {'name': 'Foot'}, {'name': 'Body', 'mesh': 0}],
        'skins': [{'joints': [0, 1]}],
        'animations': [{'name': 'Synthetic walk', 'samplers': [{'input': 1, 'output': 2}], 'channels': [{'sampler': 0, 'target': {'node': 0, 'path': 'translation'}}]}],
    }


def encode(doc):
    return json.dumps(doc).encode()


class AuthoredGltfInspection(unittest.TestCase):
    def test_embedded_inventory_uses_actual_geometry_rig_and_timing(self):
        result = module.inspect_bytes(encode(fixture()))
        self.assertEqual(result['triangles'], 1)
        self.assertEqual(result['skins'][0]['jointNames'], ['Hip', 'Foot'])
        self.assertEqual(result['animations'][0]['durationSeconds'], 1)
        self.assertFalse(result['renderedSuitabilityVerified'])
        self.assertFalse(result['licenseVerified'])

    def test_quota_html_and_remote_or_local_file_uris_are_rejected(self):
        with self.assertRaises(ValueError):
            module.inspect_bytes(b'<!DOCTYPE html><title>Quota exceeded</title>')
        for uri in ['https://example.invalid/secret?token=fixture', '../outside.bin', 'file:///private/file', '//example.invalid/x']:
            doc = fixture()
            doc['buffers'][0]['uri'] = uri
            with self.assertRaisesRegex(ValueError, 'external') as error:
                module.inspect_bytes(encode(doc))
            self.assertNotIn(uri, str(error.exception))

    def test_buffer_view_and_accessor_truncation_are_rejected(self):
        for mutate in [lambda d: d['bufferViews'][0].update(byteLength=1000), lambda d: d['accessors'][0].update(count=10)]:
            doc = fixture()
            mutate(doc)
            with self.assertRaises(ValueError):
                module.inspect_bytes(encode(doc))

    def test_invalid_rig_and_animation_references_are_rejected(self):
        for mutate in [lambda d: d['skins'][0].update(joints=[99]), lambda d: d['nodes'][1].update(children=[0]), lambda d: d['animations'][0]['channels'][0]['target'].update(node=99)]:
            doc = fixture()
            mutate(doc)
            with self.assertRaises(ValueError):
                module.inspect_bytes(encode(doc))

    def test_glb_binary_and_header_are_checked(self):
        doc = fixture()
        binary = base64.b64decode(doc['buffers'][0].pop('uri').split(',')[1])
        data = encode(doc)
        data += b' ' * (-len(data) % 4)
        glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(data) + 8 + len(binary)) + struct.pack('<II', len(data), 0x4E4F534A) + data + struct.pack('<II', len(binary), 0x004E4942) + binary
        self.assertEqual(module.inspect_bytes(glb)['triangles'], 1)
        with self.assertRaises(ValueError):
            module.inspect_bytes(glb[:-4])


if __name__ == '__main__':
    unittest.main()
