# Isolated review loader

Official Three.js r180 GLTFLoader and BufferGeometryUtils, unmodified. Same 0.180.0 version as the production renderer. MIT license: [project THREE-LICENSE](../../../vendor/THREE-LICENSE).

Sources:
- https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/jsm/loaders/GLTFLoader.js
- https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/jsm/utils/BufferGeometryUtils.js

Only tests/authored-avatar-review.html imports these modules with a local import map. The runtime package builder does not include tests/; no production dependency or CDN loading was introduced.
