"""Offline inventory for embedded glTF/GLB candidates; not a full glTF validator.

Never fetches URIs, extracts archives, executes content, or asserts asset licensing.
Supported subset: embedded buffers/images, dense accessors, triangle primitives.
"""
import argparse
import base64
import hashlib
import json
import math
import struct
from pathlib import Path

MAX_BYTES = 32 * 1024 * 1024
COMPONENTS = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
SHAPES = {'SCALAR': (1, 1), 'VEC2': (1, 2), 'VEC3': (1, 3), 'VEC4': (1, 4), 'MAT2': (2, 2), 'MAT3': (3, 3), 'MAT4': (4, 4)}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def index(items, value):
    require(type(value) is int and 0 <= value < len(items), 'Invalid object reference')
    return items[value]


def natural(value):
    require(type(value) is int and value >= 0, 'Invalid byte/count value')
    return value


def inspect_bytes(raw):
    require(0 < len(raw) <= MAX_BYTES, 'File exceeds inspection allowance or is empty')
    binary = None
    is_glb = raw[:4] == b'glTF'
    if is_glb:
        require(len(raw) >= 20, 'Truncated GLB header')
        _, version, length = struct.unpack_from('<4sII', raw)
        require(version == 2 and length == len(raw), 'Invalid GLB version/length')
        chunks, offset = [], 12
        while offset < len(raw):
            require(offset + 8 <= len(raw), 'Truncated GLB chunk header')
            size, kind = struct.unpack_from('<II', raw, offset)
            offset += 8
            require(size % 4 == 0 and offset + size <= len(raw), 'Truncated or unaligned GLB chunk')
            chunks.append((kind, raw[offset:offset + size]))
            offset += size
        require(1 <= len(chunks) <= 2 and chunks[0][0] == 0x4E4F534A, 'Unsupported GLB chunks')
        if len(chunks) == 2:
            require(chunks[1][0] == 0x004E4942, 'Unsupported GLB binary chunk')
            binary = chunks[1][1]
        raw_json = chunks[0][1]
    else:
        raw_json = raw
    try:
        doc = json.loads(raw_json)
    except (ValueError, UnicodeError):
        raise ValueError('Not glTF JSON/GLB; HTML/download error pages are not models') from None
    require(isinstance(doc, dict) and doc.get('asset', {}).get('version') == '2.0', 'Expected glTF 2.0')
    require(not doc.get('extensionsRequired'), 'Required extensions need separate loader review')

    def check_uris(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key == 'uri':
                    require(isinstance(child, str) and child.startswith('data:') and ';base64,' in child, 'Unsupported external or non-base64 URI; no network or filesystem access performed')
                check_uris(child)
        elif isinstance(value, list):
            for child in value:
                check_uris(child)
    check_uris(doc)

    buffers = []
    for i, buffer in enumerate(doc.get('buffers', [])):
        size = natural(buffer['byteLength'])
        require(size <= MAX_BYTES, 'Buffer exceeds inspection allowance')
        if 'uri' in buffer:
            try:
                data = base64.b64decode(buffer['uri'].split(',', 1)[1], validate=True)
            except ValueError:
                raise ValueError('Invalid embedded base64') from None
            require(len(data) == size, 'Embedded buffer byteLength mismatch')
        else:
            require(i == 0 and binary is not None and size <= len(binary) <= size + 3, 'Missing or invalid GLB buffer')
            data = binary[:size]
        buffers.append(data)
    require(sum(map(len, buffers)) <= MAX_BYTES, 'Combined buffers exceed inspection allowance')
    views = doc.get('bufferViews', [])
    for view in views:
        data = index(buffers, view['buffer'])
        require(natural(view.get('byteOffset', 0)) + natural(view['byteLength']) <= len(data), 'Buffer view exceeds buffer')
    accessors = doc.get('accessors', [])
    for accessor in accessors:
        require('sparse' not in accessor and 'bufferView' in accessor, 'Sparse/implicit accessors need separate review')
        view = index(views, accessor['bufferView'])
        require(accessor['componentType'] in COMPONENTS and accessor['type'] in SHAPES, 'Unsupported accessor layout')
        component = COMPONENTS[accessor['componentType']]
        columns, rows = SHAPES[accessor['type']]
        column_bytes = rows * component
        element = columns * (column_bytes if columns == 1 else (column_bytes + 3) // 4 * 4)
        count = natural(accessor['count'])
        stride = natural(view.get('byteStride', element))
        require(count > 0 and stride >= element and stride % component == 0, 'Invalid accessor count/stride')
        end = natural(accessor.get('byteOffset', 0)) + (count - 1) * stride + element
        require(end <= view['byteLength'], 'Accessor exceeds buffer view')

    nodes = doc.get('nodes', [])
    parents = {}
    for i, node in enumerate(nodes):
        for child in node.get('children', []):
            index(nodes, child)
            require(child not in parents, 'Node has multiple parents')
            parents[child] = i
    for i in range(len(nodes)):
        seen = set()
        while i in parents:
            require(i not in seen, 'Node hierarchy cycle')
            seen.add(i)
            i = parents[i]
    skins = []
    for skin in doc.get('skins', []):
        names = [index(nodes, joint).get('name', str(joint)) for joint in skin['joints']]
        require(names and len(set(skin['joints'])) == len(names), 'Empty or repeated skin joints')
        skins.append({'jointCount': len(names), 'jointNames': names})
    triangles = 0
    for mesh in doc.get('meshes', []):
        for primitive in mesh['primitives']:
            require(primitive.get('mode', 4) == 4, 'Non-triangle primitive needs separate review')
            position = index(accessors, primitive['attributes']['POSITION'])
            require(position['type'] == 'VEC3', 'Invalid position accessor')
            count = index(accessors, primitive['indices'])['count'] if 'indices' in primitive else position['count']
            require(count % 3 == 0, 'Incomplete triangle primitive')
            triangles += count // 3
    for node in nodes:
        if 'mesh' in node:
            index(doc.get('meshes', []), node['mesh'])
        if 'skin' in node:
            index(skins, node['skin'])
    animations = []
    for animation in doc.get('animations', []):
        duration = 0
        for channel in animation['channels']:
            index(nodes, channel['target']['node'])
            require(channel['target']['path'] in ('translation', 'rotation', 'scale', 'weights'), 'Unsupported animation target')
            sampler = index(animation['samplers'], channel['sampler'])
            index(accessors, sampler['output'])
            accessor = index(accessors, sampler['input'])
            require(accessor['componentType'] == 5126 and accessor['type'] == 'SCALAR', 'Animation times must be float scalars')
            view = index(views, accessor['bufferView'])
            offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
            stride = view.get('byteStride', 4)
            times = [struct.unpack_from('<f', buffers[view['buffer']], offset + n * stride)[0] for n in range(accessor['count'])]
            require(all(math.isfinite(t) and t >= 0 for t in times) and all(b > a for a, b in zip(times, times[1:])), 'Invalid animation time sequence')
            duration = max(duration, times[-1])
        animations.append({'name': animation.get('name', ''), 'channels': len(animation['channels']), 'durationSeconds': duration})
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'format': 'glb' if is_glb else 'gltf', 'meshCount': len(doc.get('meshes', [])), 'triangles': triangles, 'skins': skins, 'animations': animations, 'materialCount': len(doc.get('materials', [])), 'imageCount': len(doc.get('images', [])), 'embeddedBufferBytes': sum(map(len, buffers)), 'externalResourcesFetched': False, 'licenseVerified': False, 'renderedSuitabilityVerified': False, 'scope': 'Bounded embedded-file inventory and basic structural checks; not full Khronos validation, actual skin quality, license or animation/render acceptance.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    args = parser.parse_args()
    try:
        require(args.file.stat().st_size <= MAX_BYTES, 'File exceeds inspection allowance')
        print(json.dumps(inspect_bytes(args.file.read_bytes()), ensure_ascii=False, indent=2))
    except ValueError as error:
        parser.exit(1, f'Model inspection refused: {error}\n')
    except (KeyError, TypeError, AttributeError, IndexError, RecursionError, OSError, struct.error) as error:
        parser.exit(1, f'Model inspection refused: {type(error).__name__}; candidate needs review.\n')
