Three r180 add-ons for local authored character loading. Sources are the existing
verified tests/vendor/r180 official GLTFLoader and BufferGeometryUtils. The only
edit is `from 'three'` -> `from '../../three.module.min.js'` for offline use.
Source and derived SHA are in assets/characters/provenance.json. MIT license:
../THREE-LICENSE. No network runtime imports or new package dependencies.
