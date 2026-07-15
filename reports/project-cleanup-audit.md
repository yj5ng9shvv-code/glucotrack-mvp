# GlukoTrack Project Cleanup Audit

Generated: 2026-07-15T13:46:09.336Z

Phase: **analysis only**. No files were deleted.

## Backup Gate

The user required a full backup before audit. This report assumes the verified backup was created externally before running the audit.

## Git State

- Branch: `main`
- HEAD: `cf1ead6991867c57429a630265903d77d1abdade`
- Cleanup branch exists: true
- `before-full-cleanup` tag exists: true
- Working tree dirty: true

**BLOCKER:** cleanup/deletion must not start while uncommitted changes exist unless the user explicitly approves how to preserve them.

## Inventory

- Files: 8113
- Directories: 2591
- Total file size: 3388.84 MB

## Largest Directories

| Directory | Size |
|---|---:|
| `build` | 1864.04 MB |
| `build/app` | 1777.67 MB |
| `build/app/intermediates` | 1488.73 MB |
| `build/app/intermediates/merged_native_libs` | 1202.28 MB |
| `build/app/intermediates/merged_native_libs/debug` | 1202.28 MB |
| `build/app/intermediates/merged_native_libs/debug/mergeDebugNativeLibs` | 1202.28 MB |
| `build/app/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out` | 1202.28 MB |
| `build/app/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out/lib` | 1202.28 MB |
| `release` | 1072.59 MB |
| `build/app/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out/lib/arm64-v8a` | 564.12 MB |
| `build/app/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out/lib/x86_64` | 337.19 MB |
| `build/app/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out/lib/armeabi-v7a` | 300.96 MB |
| `build/app/outputs` | 288.79 MB |
| `build/app/outputs/apk` | 144.35 MB |
| `build/app/outputs/apk/debug` | 144.35 MB |
| `build/app/outputs/flutter-apk` | 144.35 MB |
| `build/app/intermediates/stripped_native_libs` | 115.62 MB |
| `build/app/intermediates/stripped_native_libs/debug` | 115.62 MB |
| `build/app/intermediates/stripped_native_libs/debug/stripDebugDebugSymbols` | 115.62 MB |
| `build/app/intermediates/stripped_native_libs/debug/stripDebugDebugSymbols/out` | 115.62 MB |
| `build/app/intermediates/stripped_native_libs/debug/stripDebugDebugSymbols/out/lib` | 115.62 MB |
| `.dart_tool` | 90.31 MB |
| `.dart_tool/flutter_build` | 90.27 MB |
| `.git` | 86.50 MB |
| `.git/objects` | 86.39 MB |

## Dependency Snapshot

- pubspec.yaml present: true
- package.json files: `backend/node_modules/@types/node/package.json`, `backend/node_modules/@types/node-fetch/package.json`, `backend/node_modules/abort-controller/package.json`, `backend/node_modules/accepts/package.json`, `backend/node_modules/agent-base/package.json`, `backend/node_modules/agentkeepalive/package.json`, `backend/node_modules/append-field/package.json`, `backend/node_modules/array-flatten/package.json`, `backend/node_modules/asynckit/package.json`, `backend/node_modules/aws-ssl-profiles/package.json`, `backend/node_modules/base64-js/package.json`, `backend/node_modules/bcryptjs/package.json`, `backend/node_modules/bcryptjs/umd/package.json`, `backend/node_modules/bignumber.js/package.json`, `backend/node_modules/body-parser/package.json`, `backend/node_modules/buffer-equal-constant-time/package.json`, `backend/node_modules/buffer-from/package.json`, `backend/node_modules/busboy/package.json`, `backend/node_modules/bytes/package.json`, `backend/node_modules/call-bind-apply-helpers/package.json`, `backend/node_modules/call-bound/package.json`, `backend/node_modules/combined-stream/package.json`, `backend/node_modules/concat-stream/package.json`, `backend/node_modules/content-disposition/package.json`, `backend/node_modules/content-type/package.json`, `backend/node_modules/cookie/package.json`, `backend/node_modules/cookie-signature/package.json`, `backend/node_modules/data-uri-to-buffer/package.json`, `backend/node_modules/debug/package.json`, `backend/node_modules/delayed-stream/package.json`, `backend/node_modules/denque/package.json`, `backend/node_modules/depd/package.json`, `backend/node_modules/destroy/package.json`, `backend/node_modules/dotenv/package.json`, `backend/node_modules/dunder-proto/package.json`, `backend/node_modules/ecdsa-sig-formatter/package.json`, `backend/node_modules/ee-first/package.json`, `backend/node_modules/encodeurl/package.json`, `backend/node_modules/es-define-property/package.json`, `backend/node_modules/es-errors/package.json`, `backend/node_modules/es-object-atoms/package.json`, `backend/node_modules/es-set-tostringtag/package.json`, `backend/node_modules/escape-html/package.json`, `backend/node_modules/etag/package.json`, `backend/node_modules/event-target-shim/package.json`, `backend/node_modules/express/package.json`, `backend/node_modules/extend/package.json`, `backend/node_modules/fetch-blob/node_modules/web-streams-polyfill/es2018/package.json`, `backend/node_modules/fetch-blob/node_modules/web-streams-polyfill/es6/package.json`, `backend/node_modules/fetch-blob/node_modules/web-streams-polyfill/package.json`, `backend/node_modules/fetch-blob/node_modules/web-streams-polyfill/ponyfill/es2018/package.json`, `backend/node_modules/fetch-blob/node_modules/web-streams-polyfill/ponyfill/es6/package.json`, `backend/node_modules/fetch-blob/node_modules/web-streams-polyfill/ponyfill/package.json`, `backend/node_modules/fetch-blob/package.json`, `backend/node_modules/finalhandler/package.json`, `backend/node_modules/form-data/package.json`, `backend/node_modules/form-data-encoder/lib/cjs/package.json`, `backend/node_modules/form-data-encoder/lib/esm/package.json`, `backend/node_modules/form-data-encoder/package.json`, `backend/node_modules/formdata-node/lib/cjs/package.json`, `backend/node_modules/formdata-node/lib/esm/package.json`, `backend/node_modules/formdata-node/package.json`, `backend/node_modules/formdata-polyfill/package.json`, `backend/node_modules/forwarded/package.json`, `backend/node_modules/fresh/package.json`, `backend/node_modules/function-bind/package.json`, `backend/node_modules/gaxios/build/esm/package.json`, `backend/node_modules/gaxios/node_modules/node-fetch/package.json`, `backend/node_modules/gaxios/package.json`, `backend/node_modules/gcp-metadata/package.json`, `backend/node_modules/generate-function/package.json`, `backend/node_modules/get-intrinsic/package.json`, `backend/node_modules/get-proto/package.json`, `backend/node_modules/google-auth-library/package.json`, `backend/node_modules/google-logging-utils/package.json`, `backend/node_modules/gopd/package.json`, `backend/node_modules/gtoken/package.json`, `backend/node_modules/has-symbols/package.json`, `backend/node_modules/has-tostringtag/package.json`, `backend/node_modules/hasown/package.json`, `backend/node_modules/http-errors/package.json`, `backend/node_modules/https-proxy-agent/node_modules/debug/package.json`, `backend/node_modules/https-proxy-agent/node_modules/ms/package.json`, `backend/node_modules/https-proxy-agent/package.json`, `backend/node_modules/humanize-ms/package.json`, `backend/node_modules/iconv-lite/package.json`, `backend/node_modules/inherits/package.json`, `backend/node_modules/ipaddr.js/package.json`, `backend/node_modules/is-property/package.json`, `backend/node_modules/json-bigint/package.json`, `backend/node_modules/jsonwebtoken/node_modules/ms/package.json`, `backend/node_modules/jsonwebtoken/package.json`, `backend/node_modules/jwa/package.json`, `backend/node_modules/jws/package.json`, `backend/node_modules/lodash.includes/package.json`, `backend/node_modules/lodash.isboolean/package.json`, `backend/node_modules/lodash.isinteger/package.json`, `backend/node_modules/lodash.isnumber/package.json`, `backend/node_modules/lodash.isplainobject/package.json`, `backend/node_modules/lodash.isstring/package.json`, `backend/node_modules/lodash.once/package.json`, `backend/node_modules/long/package.json`, `backend/node_modules/long/umd/package.json`, `backend/node_modules/lru.min/package.json`, `backend/node_modules/math-intrinsics/package.json`, `backend/node_modules/media-typer/package.json`, `backend/node_modules/merge-descriptors/package.json`, `backend/node_modules/methods/package.json`, `backend/node_modules/mime/package.json`, `backend/node_modules/mime-db/package.json`, `backend/node_modules/mime-types/package.json`, `backend/node_modules/ms/package.json`, `backend/node_modules/multer/package.json`, `backend/node_modules/mysql2/node_modules/iconv-lite/package.json`, `backend/node_modules/mysql2/package.json`, `backend/node_modules/named-placeholders/package.json`, `backend/node_modules/negotiator/package.json`, `backend/node_modules/node-domexception/package.json`, `backend/node_modules/node-fetch/package.json`, `backend/node_modules/nodemailer/package.json`, `backend/node_modules/object-inspect/package.json`, `backend/node_modules/on-finished/package.json`, `backend/node_modules/openai/node_modules/@types/node/package.json`, `backend/node_modules/openai/node_modules/undici-types/package.json`, `backend/node_modules/openai/package.json`, `backend/node_modules/parseurl/package.json`, `backend/node_modules/path-to-regexp/package.json`, `backend/node_modules/proxy-addr/package.json`, `backend/node_modules/qs/package.json`, `backend/node_modules/range-parser/package.json`, `backend/node_modules/raw-body/package.json`, `backend/node_modules/readable-stream/package.json`, `backend/node_modules/safe-buffer/package.json`, `backend/node_modules/safer-buffer/package.json`, `backend/node_modules/semver/package.json`, `backend/node_modules/send/node_modules/ms/package.json`, `backend/node_modules/send/package.json`, `backend/node_modules/serve-static/package.json`, `backend/node_modules/setprototypeof/package.json`, `backend/node_modules/side-channel/package.json`, `backend/node_modules/side-channel-list/package.json`, `backend/node_modules/side-channel-map/package.json`, `backend/node_modules/side-channel-weakmap/package.json`, `backend/node_modules/sql-escaper/package.json`, `backend/node_modules/statuses/package.json`, `backend/node_modules/streamsearch/package.json`, `backend/node_modules/string_decoder/package.json`, `backend/node_modules/stripe/cjs/package.json`, `backend/node_modules/stripe/esm/package.json`, `backend/node_modules/stripe/package.json`, `backend/node_modules/toidentifier/package.json`, `backend/node_modules/tr46/package.json`, `backend/node_modules/type-is/package.json`, `backend/node_modules/typedarray/package.json`, `backend/node_modules/undici-types/package.json`, `backend/node_modules/unpipe/package.json`, `backend/node_modules/util-deprecate/package.json`, `backend/node_modules/utils-merge/package.json`, `backend/node_modules/vary/package.json`, `backend/node_modules/web-streams-polyfill/es5/package.json`, `backend/node_modules/web-streams-polyfill/package.json`, `backend/node_modules/web-streams-polyfill/polyfill/es5/package.json`, `backend/node_modules/web-streams-polyfill/polyfill/package.json`, `backend/node_modules/webidl-conversions/package.json`, `backend/node_modules/whatwg-url/package.json`, `backend/package.json`, `backend_proxy_sample/package.json`, `package.json`, `release/backend_sos_geo_update/package.json`
- lock files: `backend/node_modules/.package-lock.json`, `backend/node_modules/combined-stream/yarn.lock`, `backend/package-lock.json`, `pubspec.lock`

## Cleanup Candidates

These are candidates only. Nothing in this table is approved for deletion until each item is checked against imports, routes, build files, dynamic loading, deployment, and old client compatibility.

| Path | Category | Risk | Size | Reason | Proposed action |
|---|---|---:|---:|---|---|
| `.apkcheck-api-fixed/AndroidManifest.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.01 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/assets/dexopt/baseline.prof` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/assets/dexopt/baseline.profm` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/assets/flutter_assets/AssetManifest.bin` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/assets/flutter_assets/FontManifest.json` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/assets/flutter_assets/fonts/MaterialIcons-Regular.otf` | DUPLICATE_OR_OBSOLETE_NAME | medium | 1.57 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/assets/flutter_assets/NativeAssetsManifest.json` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/assets/flutter_assets/NOTICES.Z` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.10 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/assets/flutter_assets/packages/cupertino_icons/assets/CupertinoIcons.ttf` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.25 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/assets/flutter_assets/shaders/ink_sparkle.frag` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.02 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/assets/flutter_assets/shaders/stretch_effect.frag` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.02 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/classes.dex` | DUPLICATE_OR_OBSOLETE_NAME | medium | 1.29 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/DebugProbesKt.bin` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/googleid.properties` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/kotlin/annotation/annotation.kotlin_builtins` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/kotlin/collections/collections.kotlin_builtins` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.01 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/kotlin/concurrent/atomics/atomics.kotlin_builtins` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/kotlin/coroutines/coroutines.kotlin_builtins` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/kotlin/internal/internal.kotlin_builtins` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/kotlin/kotlin.kotlin_builtins` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.03 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/kotlin/ranges/ranges.kotlin_builtins` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/kotlin/reflect/reflect.kotlin_builtins` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/kotlin-tooling-metadata.json` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/lib/arm64-v8a/libapp.so` | DUPLICATE_OR_OBSOLETE_NAME | medium | 7.56 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/lib/arm64-v8a/libdatastore_shared_counter.so` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.01 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/lib/arm64-v8a/libflutter.so` | DUPLICATE_OR_OBSOLETE_NAME | medium | 10.59 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/lib/armeabi-v7a/libapp.so` | DUPLICATE_OR_OBSOLETE_NAME | medium | 8.53 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/lib/armeabi-v7a/libdatastore_shared_counter.so` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/lib/armeabi-v7a/libflutter.so` | DUPLICATE_OR_OBSOLETE_NAME | medium | 7.72 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/lib/x86_64/libapp.so` | DUPLICATE_OR_OBSOLETE_NAME | medium | 7.81 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/lib/x86_64/libdatastore_shared_counter.so` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.01 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/lib/x86_64/libflutter.so` | DUPLICATE_OR_OBSOLETE_NAME | medium | 11.77 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx/annotation/annotation/LICENSE.txt` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.01 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.activity_activity-ktx.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.activity_activity.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.annotation_annotation-experimental.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.appcompat_appcompat-resources.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.appcompat_appcompat.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.arch.core_core-runtime.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.asynclayoutinflater_asynclayoutinflater.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.biometric_biometric.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.browser_browser.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.compose.runtime_runtime-annotation.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.coordinatorlayout_coordinatorlayout.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.core_core-ktx.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.core_core-viewtree.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.core_core.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.credentials_credentials-play-services-auth.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.credentials_credentials.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.cursoradapter_cursoradapter.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.customview_customview.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.datastore_datastore-core.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.datastore_datastore-preferences-core.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.datastore_datastore-preferences.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.datastore_datastore.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.documentfile_documentfile.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.drawerlayout_drawerlayout.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.exifinterface_exifinterface.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.fragment_fragment-ktx.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.fragment_fragment.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.interpolator_interpolator.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.legacy_legacy-support-core-ui.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.legacy_legacy-support-core-utils.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-livedata-core-ktx.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-livedata-core.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-process.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-runtime-ktx.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-runtime.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-viewmodel-ktx.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-viewmodel-savedstate.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-viewmodel.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.loader_loader.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.localbroadcastmanager_localbroadcastmanager.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.navigationevent_navigationevent.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.preference_preference.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.print_print.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.profileinstaller_profileinstaller.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.recyclerview_recyclerview.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.savedstate_savedstate-ktx.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.savedstate_savedstate.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.slidingpanelayout_slidingpanelayout.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.startup_startup-runtime.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.swiperefreshlayout_swiperefreshlayout.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.tracing_tracing.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.transition_transition.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.vectordrawable_vectordrawable-animated.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.vectordrawable_vectordrawable.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.versionedparcelable_versionedparcelable.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.viewpager_viewpager.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.window.extensions.core_core.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.window_window-java.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/androidx.window_window.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/com/android/build` | GENERATED | low | 0.00 MB | Directory name matches common generated/local workspace output. | candidate: add/confirm gitignore, remove only after approval |
| `.apkcheck-api-fixed/META-INF/com/android/build/gradle/app-metadata.properties` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/kotlinx_coroutines_android.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/kotlinx_coroutines_core.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/kotlinx_coroutines_play_services.version` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/services/w4.a` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/services/w4.b` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/META-INF/version-control-info.textproto` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/play-services-auth-api-phone.properties` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/play-services-auth-base.properties` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/play-services-auth-blockstore.properties` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/play-services-auth.properties` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/play-services-base.properties` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/play-services-basement.properties` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/play-services-fido.properties` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/play-services-identity-credentials.properties` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/play-services-tasks.properties` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/-B.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/0c.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/0Z.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/15.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/1e.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/1I.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/1J.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/27.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/2d.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/2f.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/2z.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/33.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/3A.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/49.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/4B.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/4k.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/4o.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/4u.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/5D.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/5K.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/5R.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/5z.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/62.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/6Q.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/6t.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/6Y.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/7C.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/7H.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/7I.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/7i.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/7N.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/7o.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/7_.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/80.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/8F.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/8h.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/9k.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/9L.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/9n.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/9T.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/9T1.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/9T2.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/9w.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/9X.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/9z.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/a-.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/A4.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/AJ.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/ar.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/aU.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/aW.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/BG.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/BJ.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/BL.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/bL.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/bm.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/bn.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/BX.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/c5.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/ca.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Ce.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/CF.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/color-v23/abc_tint_btn_checkable.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/color-v23/abc_tint_default.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/color-v23/abc_tint_edittext.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/color-v23/abc_tint_seek_thumb.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/color-v23/abc_tint_spinner.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/color-v23/abc_tint_switch_track.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/d3.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/d5.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/DL.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/DL.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/dO.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/dt.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/dW.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/dY.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/DZ.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/D_.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/EA.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Eg.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/ej.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/El.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/eN.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/eR.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/eT.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/fb.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/FE.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/fM.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/fN.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/FS.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/FW.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/G2.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/g8.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Gf.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/gj.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/gK.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/GK.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Gm.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/gR.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/gt.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/gv.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Gw.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/gX.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/gZ.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/h4.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/h7.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/hE.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/hH.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/hk.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Ho.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/hq.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/hZ.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/i0.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/i6.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/In.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/io.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/iO.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/iQ.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/iR.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/IX.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Iy.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/j3.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/j4.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/JJ.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Jl.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/jq.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/JR.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/jS.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/K0.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/K5.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/K5.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/ke.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Ke.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/kf.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/KG.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/KH.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Ki.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Ki1.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/kJ.9.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/kj.xml` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |
| `.apkcheck-api-fixed/res/Kk.png` | DUPLICATE_OR_OBSOLETE_NAME | medium | 0.00 MB | Filename/path contains old/copy/backup/temp/fixed/final style marker. | review before deletion |

## Duplicate Content Groups

- 0.01 MB: `.apkcheck-api-fixed/AndroidManifest.xml`, `.apkcheck-v2/AndroidManifest.xml`
- 0.00 MB: `.apkcheck-api-fixed/assets/dexopt/baseline.prof`, `.apkcheck-v2/assets/dexopt/baseline.prof`
- 0.00 MB: `.apkcheck-api-fixed/assets/dexopt/baseline.profm`, `.apkcheck-v2/assets/dexopt/baseline.profm`
- 0.00 MB: `.apkcheck-api-fixed/assets/flutter_assets/AssetManifest.bin`, `.apkcheck-v2/assets/flutter_assets/AssetManifest.bin`
- 0.00 MB: `.apkcheck-api-fixed/assets/flutter_assets/FontManifest.json`, `.apkcheck-v2/assets/flutter_assets/FontManifest.json`, `build/app/intermediates/assets/debug/mergeDebugAssets/flutter_assets/FontManifest.json`, `build/app/intermediates/flutter/debug/flutter_assets/FontManifest.json`, `build/unit_test_assets/FontManifest.json`, `build/web/assets/FontManifest.json`, `website_source/app/assets/FontManifest.json`
- 1.57 MB: `.apkcheck-api-fixed/assets/flutter_assets/fonts/MaterialIcons-Regular.otf`, `.apkcheck-v2/assets/flutter_assets/fonts/MaterialIcons-Regular.otf`, `build/app/intermediates/assets/debug/mergeDebugAssets/flutter_assets/fonts/MaterialIcons-Regular.otf`, `build/app/intermediates/flutter/debug/flutter_assets/fonts/MaterialIcons-Regular.otf`, `build/unit_test_assets/fonts/MaterialIcons-Regular.otf`
- 0.00 MB: `.apkcheck-api-fixed/assets/flutter_assets/NativeAssetsManifest.json`, `.apkcheck-v2/assets/flutter_assets/NativeAssetsManifest.json`, `.dart_tool/flutter_build/6a1eb0a62e0fdf41d5930320d68c731e/native_assets.json`, `build/app/intermediates/assets/debug/mergeDebugAssets/flutter_assets/NativeAssetsManifest.json`, `build/app/intermediates/flutter/debug/flutter_assets/NativeAssetsManifest.json`, `build/native_assets/windows/native_assets.json`, `build/unit_test_assets/NativeAssetsManifest.json`
- 0.10 MB: `.apkcheck-api-fixed/assets/flutter_assets/NOTICES.Z`, `.apkcheck-v2/assets/flutter_assets/NOTICES.Z`
- 0.25 MB: `.apkcheck-api-fixed/assets/flutter_assets/packages/cupertino_icons/assets/CupertinoIcons.ttf`, `.apkcheck-v2/assets/flutter_assets/packages/cupertino_icons/assets/CupertinoIcons.ttf`, `build/app/intermediates/assets/debug/mergeDebugAssets/flutter_assets/packages/cupertino_icons/assets/CupertinoIcons.ttf`, `build/app/intermediates/flutter/debug/flutter_assets/packages/cupertino_icons/assets/CupertinoIcons.ttf`, `build/unit_test_assets/packages/cupertino_icons/assets/CupertinoIcons.ttf`
- 0.02 MB: `.apkcheck-api-fixed/assets/flutter_assets/shaders/ink_sparkle.frag`, `.apkcheck-v2/assets/flutter_assets/shaders/ink_sparkle.frag`, `build/app/intermediates/assets/debug/mergeDebugAssets/flutter_assets/shaders/ink_sparkle.frag`, `build/app/intermediates/flutter/debug/flutter_assets/shaders/ink_sparkle.frag`
- 0.02 MB: `.apkcheck-api-fixed/assets/flutter_assets/shaders/stretch_effect.frag`, `.apkcheck-v2/assets/flutter_assets/shaders/stretch_effect.frag`, `build/app/intermediates/assets/debug/mergeDebugAssets/flutter_assets/shaders/stretch_effect.frag`, `build/app/intermediates/flutter/debug/flutter_assets/shaders/stretch_effect.frag`
- 1.29 MB: `.apkcheck-api-fixed/classes.dex`, `.apkcheck-v2/classes.dex`
- 0.00 MB: `.apkcheck-api-fixed/DebugProbesKt.bin`, `.apkcheck-v2/DebugProbesKt.bin`
- 0.00 MB: `.apkcheck-api-fixed/googleid.properties`, `.apkcheck-v2/googleid.properties`
- 0.00 MB: `.apkcheck-api-fixed/kotlin/annotation/annotation.kotlin_builtins`, `.apkcheck-v2/kotlin/annotation/annotation.kotlin_builtins`
- 0.01 MB: `.apkcheck-api-fixed/kotlin/collections/collections.kotlin_builtins`, `.apkcheck-v2/kotlin/collections/collections.kotlin_builtins`
- 0.00 MB: `.apkcheck-api-fixed/kotlin/concurrent/atomics/atomics.kotlin_builtins`, `.apkcheck-v2/kotlin/concurrent/atomics/atomics.kotlin_builtins`
- 0.00 MB: `.apkcheck-api-fixed/kotlin/coroutines/coroutines.kotlin_builtins`, `.apkcheck-v2/kotlin/coroutines/coroutines.kotlin_builtins`
- 0.00 MB: `.apkcheck-api-fixed/kotlin/internal/internal.kotlin_builtins`, `.apkcheck-v2/kotlin/internal/internal.kotlin_builtins`
- 0.03 MB: `.apkcheck-api-fixed/kotlin/kotlin.kotlin_builtins`, `.apkcheck-v2/kotlin/kotlin.kotlin_builtins`
- 0.00 MB: `.apkcheck-api-fixed/kotlin/ranges/ranges.kotlin_builtins`, `.apkcheck-v2/kotlin/ranges/ranges.kotlin_builtins`
- 0.00 MB: `.apkcheck-api-fixed/kotlin/reflect/reflect.kotlin_builtins`, `.apkcheck-v2/kotlin/reflect/reflect.kotlin_builtins`
- 0.00 MB: `.apkcheck-api-fixed/kotlin-tooling-metadata.json`, `.apkcheck-v2/kotlin-tooling-metadata.json`
- 0.01 MB: `.apkcheck-api-fixed/lib/arm64-v8a/libdatastore_shared_counter.so`, `.apkcheck-v2/lib/arm64-v8a/libdatastore_shared_counter.so`, `build/app/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out/lib/arm64-v8a/libdatastore_shared_counter.so`, `build/app/intermediates/stripped_native_libs/debug/stripDebugDebugSymbols/out/lib/arm64-v8a/libdatastore_shared_counter.so`
- 10.59 MB: `.apkcheck-api-fixed/lib/arm64-v8a/libflutter.so`, `.apkcheck-v2/lib/arm64-v8a/libflutter.so`
- 0.00 MB: `.apkcheck-api-fixed/lib/armeabi-v7a/libdatastore_shared_counter.so`, `.apkcheck-v2/lib/armeabi-v7a/libdatastore_shared_counter.so`, `build/app/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out/lib/armeabi-v7a/libdatastore_shared_counter.so`, `build/app/intermediates/stripped_native_libs/debug/stripDebugDebugSymbols/out/lib/armeabi-v7a/libdatastore_shared_counter.so`
- 7.72 MB: `.apkcheck-api-fixed/lib/armeabi-v7a/libflutter.so`, `.apkcheck-v2/lib/armeabi-v7a/libflutter.so`
- 0.01 MB: `.apkcheck-api-fixed/lib/x86_64/libdatastore_shared_counter.so`, `.apkcheck-v2/lib/x86_64/libdatastore_shared_counter.so`, `build/app/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out/lib/x86_64/libdatastore_shared_counter.so`, `build/app/intermediates/stripped_native_libs/debug/stripDebugDebugSymbols/out/lib/x86_64/libdatastore_shared_counter.so`
- 11.77 MB: `.apkcheck-api-fixed/lib/x86_64/libflutter.so`, `.apkcheck-v2/lib/x86_64/libflutter.so`
- 0.01 MB: `.apkcheck-api-fixed/META-INF/androidx/annotation/annotation/LICENSE.txt`, `.apkcheck-v2/META-INF/androidx/annotation/annotation/LICENSE.txt`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.activity_activity-ktx.version`, `.apkcheck-api-fixed/META-INF/androidx.activity_activity.version`, `.apkcheck-v2/META-INF/androidx.activity_activity-ktx.version`, `.apkcheck-v2/META-INF/androidx.activity_activity.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.annotation_annotation-experimental.version`, `.apkcheck-api-fixed/META-INF/androidx.transition_transition.version`, `.apkcheck-v2/META-INF/androidx.annotation_annotation-experimental.version`, `.apkcheck-v2/META-INF/androidx.transition_transition.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.appcompat_appcompat-resources.version`, `.apkcheck-api-fixed/META-INF/androidx.appcompat_appcompat.version`, `.apkcheck-api-fixed/META-INF/androidx.slidingpanelayout_slidingpanelayout.version`, `.apkcheck-api-fixed/META-INF/androidx.tracing_tracing.version`, `.apkcheck-api-fixed/META-INF/androidx.window_window-java.version`, `.apkcheck-api-fixed/META-INF/androidx.window_window.version`, `.apkcheck-v2/META-INF/androidx.appcompat_appcompat-resources.version`, `.apkcheck-v2/META-INF/androidx.appcompat_appcompat.version`, `.apkcheck-v2/META-INF/androidx.slidingpanelayout_slidingpanelayout.version`, `.apkcheck-v2/META-INF/androidx.tracing_tracing.version`, `.apkcheck-v2/META-INF/androidx.window_window-java.version`, `.apkcheck-v2/META-INF/androidx.window_window.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.arch.core_core-runtime.version`, `.apkcheck-v2/META-INF/androidx.arch.core_core-runtime.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.asynclayoutinflater_asynclayoutinflater.version`, `.apkcheck-api-fixed/META-INF/androidx.coordinatorlayout_coordinatorlayout.version`, `.apkcheck-api-fixed/META-INF/androidx.core_core-viewtree.version`, `.apkcheck-api-fixed/META-INF/androidx.cursoradapter_cursoradapter.version`, `.apkcheck-api-fixed/META-INF/androidx.documentfile_documentfile.version`, `.apkcheck-api-fixed/META-INF/androidx.drawerlayout_drawerlayout.version`, `.apkcheck-api-fixed/META-INF/androidx.interpolator_interpolator.version`, `.apkcheck-api-fixed/META-INF/androidx.legacy_legacy-support-core-ui.version`, `.apkcheck-api-fixed/META-INF/androidx.legacy_legacy-support-core-utils.version`, `.apkcheck-api-fixed/META-INF/androidx.localbroadcastmanager_localbroadcastmanager.version`, `.apkcheck-api-fixed/META-INF/androidx.print_print.version`, `.apkcheck-api-fixed/META-INF/androidx.recyclerview_recyclerview.version`, `.apkcheck-api-fixed/META-INF/androidx.swiperefreshlayout_swiperefreshlayout.version`, `.apkcheck-api-fixed/META-INF/androidx.viewpager_viewpager.version`, `.apkcheck-api-fixed/META-INF/androidx.window.extensions.core_core.version`, `.apkcheck-v2/META-INF/androidx.asynclayoutinflater_asynclayoutinflater.version`, `.apkcheck-v2/META-INF/androidx.coordinatorlayout_coordinatorlayout.version`, `.apkcheck-v2/META-INF/androidx.core_core-viewtree.version`, `.apkcheck-v2/META-INF/androidx.cursoradapter_cursoradapter.version`, `.apkcheck-v2/META-INF/androidx.documentfile_documentfile.version`, `.apkcheck-v2/META-INF/androidx.drawerlayout_drawerlayout.version`, `.apkcheck-v2/META-INF/androidx.interpolator_interpolator.version`, `.apkcheck-v2/META-INF/androidx.legacy_legacy-support-core-ui.version`, `.apkcheck-v2/META-INF/androidx.legacy_legacy-support-core-utils.version`, `.apkcheck-v2/META-INF/androidx.localbroadcastmanager_localbroadcastmanager.version`, `.apkcheck-v2/META-INF/androidx.print_print.version`, `.apkcheck-v2/META-INF/androidx.recyclerview_recyclerview.version`, `.apkcheck-v2/META-INF/androidx.swiperefreshlayout_swiperefreshlayout.version`, `.apkcheck-v2/META-INF/androidx.viewpager_viewpager.version`, `.apkcheck-v2/META-INF/androidx.window.extensions.core_core.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.biometric_biometric.version`, `.apkcheck-api-fixed/META-INF/androidx.customview_customview.version`, `.apkcheck-api-fixed/META-INF/androidx.loader_loader.version`, `.apkcheck-api-fixed/META-INF/androidx.vectordrawable_vectordrawable-animated.version`, `.apkcheck-api-fixed/META-INF/androidx.vectordrawable_vectordrawable.version`, `.apkcheck-v2/META-INF/androidx.biometric_biometric.version`, `.apkcheck-v2/META-INF/androidx.customview_customview.version`, `.apkcheck-v2/META-INF/androidx.loader_loader.version`, `.apkcheck-v2/META-INF/androidx.vectordrawable_vectordrawable-animated.version`, `.apkcheck-v2/META-INF/androidx.vectordrawable_vectordrawable.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.browser_browser.version`, `.apkcheck-api-fixed/META-INF/androidx.compose.runtime_runtime-annotation.version`, `.apkcheck-v2/META-INF/androidx.browser_browser.version`, `.apkcheck-v2/META-INF/androidx.compose.runtime_runtime-annotation.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.core_core-ktx.version`, `.apkcheck-api-fixed/META-INF/androidx.core_core.version`, `.apkcheck-v2/META-INF/androidx.core_core-ktx.version`, `.apkcheck-v2/META-INF/androidx.core_core.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.credentials_credentials-play-services-auth.version`, `.apkcheck-api-fixed/META-INF/androidx.credentials_credentials.version`, `.apkcheck-v2/META-INF/androidx.credentials_credentials-play-services-auth.version`, `.apkcheck-v2/META-INF/androidx.credentials_credentials.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.datastore_datastore-core.version`, `.apkcheck-api-fixed/META-INF/androidx.datastore_datastore-preferences-core.version`, `.apkcheck-api-fixed/META-INF/androidx.datastore_datastore-preferences.version`, `.apkcheck-api-fixed/META-INF/androidx.datastore_datastore.version`, `.apkcheck-v2/META-INF/androidx.datastore_datastore-core.version`, `.apkcheck-v2/META-INF/androidx.datastore_datastore-preferences-core.version`, `.apkcheck-v2/META-INF/androidx.datastore_datastore-preferences.version`, `.apkcheck-v2/META-INF/androidx.datastore_datastore.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.exifinterface_exifinterface.version`, `.apkcheck-v2/META-INF/androidx.exifinterface_exifinterface.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.fragment_fragment-ktx.version`, `.apkcheck-api-fixed/META-INF/androidx.fragment_fragment.version`, `.apkcheck-v2/META-INF/androidx.fragment_fragment-ktx.version`, `.apkcheck-v2/META-INF/androidx.fragment_fragment.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-livedata-core-ktx.version`, `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-livedata-core.version`, `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-process.version`, `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-runtime-ktx.version`, `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-runtime.version`, `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-viewmodel-ktx.version`, `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-viewmodel-savedstate.version`, `.apkcheck-api-fixed/META-INF/androidx.lifecycle_lifecycle-viewmodel.version`, `.apkcheck-v2/META-INF/androidx.lifecycle_lifecycle-livedata-core-ktx.version`, `.apkcheck-v2/META-INF/androidx.lifecycle_lifecycle-livedata-core.version`, `.apkcheck-v2/META-INF/androidx.lifecycle_lifecycle-process.version`, `.apkcheck-v2/META-INF/androidx.lifecycle_lifecycle-runtime-ktx.version`, `.apkcheck-v2/META-INF/androidx.lifecycle_lifecycle-runtime.version`, `.apkcheck-v2/META-INF/androidx.lifecycle_lifecycle-viewmodel-ktx.version`, `.apkcheck-v2/META-INF/androidx.lifecycle_lifecycle-viewmodel-savedstate.version`, `.apkcheck-v2/META-INF/androidx.lifecycle_lifecycle-viewmodel.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.navigationevent_navigationevent.version`, `.apkcheck-v2/META-INF/androidx.navigationevent_navigationevent.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.preference_preference.version`, `.apkcheck-api-fixed/META-INF/androidx.savedstate_savedstate-ktx.version`, `.apkcheck-api-fixed/META-INF/androidx.savedstate_savedstate.version`, `.apkcheck-v2/META-INF/androidx.preference_preference.version`, `.apkcheck-v2/META-INF/androidx.savedstate_savedstate-ktx.version`, `.apkcheck-v2/META-INF/androidx.savedstate_savedstate.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.profileinstaller_profileinstaller.version`, `.apkcheck-v2/META-INF/androidx.profileinstaller_profileinstaller.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/androidx.startup_startup-runtime.version`, `.apkcheck-api-fixed/META-INF/androidx.versionedparcelable_versionedparcelable.version`, `.apkcheck-v2/META-INF/androidx.startup_startup-runtime.version`, `.apkcheck-v2/META-INF/androidx.versionedparcelable_versionedparcelable.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/com/android/build/gradle/app-metadata.properties`, `.apkcheck-v2/META-INF/com/android/build/gradle/app-metadata.properties`, `build/app/intermediates/app_metadata/debug/writeDebugAppMetadata/app-metadata.properties`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/kotlinx_coroutines_android.version`, `.apkcheck-api-fixed/META-INF/kotlinx_coroutines_core.version`, `.apkcheck-api-fixed/META-INF/kotlinx_coroutines_play_services.version`, `.apkcheck-v2/META-INF/kotlinx_coroutines_android.version`, `.apkcheck-v2/META-INF/kotlinx_coroutines_core.version`, `.apkcheck-v2/META-INF/kotlinx_coroutines_play_services.version`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/services/w4.a`, `.apkcheck-v2/META-INF/services/w4.a`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/services/w4.b`, `.apkcheck-v2/META-INF/services/w4.b`
- 0.00 MB: `.apkcheck-api-fixed/META-INF/version-control-info.textproto`, `.apkcheck-v2/META-INF/version-control-info.textproto`
- 0.00 MB: `.apkcheck-api-fixed/play-services-auth-api-phone.properties`, `.apkcheck-v2/play-services-auth-api-phone.properties`
- 0.00 MB: `.apkcheck-api-fixed/play-services-auth-base.properties`, `.apkcheck-v2/play-services-auth-base.properties`
- 0.00 MB: `.apkcheck-api-fixed/play-services-auth-blockstore.properties`, `.apkcheck-v2/play-services-auth-blockstore.properties`
- 0.00 MB: `.apkcheck-api-fixed/play-services-auth.properties`, `.apkcheck-v2/play-services-auth.properties`
- 0.00 MB: `.apkcheck-api-fixed/play-services-base.properties`, `.apkcheck-v2/play-services-base.properties`
- 0.00 MB: `.apkcheck-api-fixed/play-services-basement.properties`, `.apkcheck-v2/play-services-basement.properties`
- 0.00 MB: `.apkcheck-api-fixed/play-services-fido.properties`, `.apkcheck-v2/play-services-fido.properties`
- 0.00 MB: `.apkcheck-api-fixed/play-services-identity-credentials.properties`, `.apkcheck-v2/play-services-identity-credentials.properties`
- 0.00 MB: `.apkcheck-api-fixed/play-services-tasks.properties`, `.apkcheck-v2/play-services-tasks.properties`
- 0.00 MB: `.apkcheck-api-fixed/res/-B.png`, `.apkcheck-v2/res/-B.png`
- 0.00 MB: `.apkcheck-api-fixed/res/0c.9.png`, `.apkcheck-v2/res/0c.9.png`
- 0.00 MB: `.apkcheck-api-fixed/res/0Z.png`, `.apkcheck-v2/res/0Z.png`
- 0.00 MB: `.apkcheck-api-fixed/res/15.png`, `.apkcheck-v2/res/15.png`
- 0.00 MB: `.apkcheck-api-fixed/res/1e.9.png`, `.apkcheck-v2/res/1e.9.png`
- 0.00 MB: `.apkcheck-api-fixed/res/1I.9.png`, `.apkcheck-v2/res/1I.9.png`
- 0.00 MB: `.apkcheck-api-fixed/res/1J.9.png`, `.apkcheck-v2/res/1J.9.png`
- 0.00 MB: `.apkcheck-api-fixed/res/27.xml`, `.apkcheck-v2/res/27.xml`
- 0.00 MB: `.apkcheck-api-fixed/res/2d.png`, `.apkcheck-v2/res/2d.png`
- 0.00 MB: `.apkcheck-api-fixed/res/2f.xml`, `.apkcheck-v2/res/2f.xml`
- 0.00 MB: `.apkcheck-api-fixed/res/2z.png`, `.apkcheck-v2/res/2z.png`
- 0.00 MB: `.apkcheck-api-fixed/res/33.9.png`, `.apkcheck-v2/res/33.9.png`
- 0.00 MB: `.apkcheck-api-fixed/res/3A.xml`, `.apkcheck-v2/res/3A.xml`
- 0.00 MB: `.apkcheck-api-fixed/res/49.png`, `.apkcheck-v2/res/49.png`
- 0.00 MB: `.apkcheck-api-fixed/res/4B.xml`, `.apkcheck-v2/res/4B.xml`
- 0.00 MB: `.apkcheck-api-fixed/res/4k.png`, `.apkcheck-v2/res/4k.png`
- 0.00 MB: `.apkcheck-api-fixed/res/4o.png`, `.apkcheck-v2/res/4o.png`
- 0.00 MB: `.apkcheck-api-fixed/res/4u.xml`, `.apkcheck-v2/res/4u.xml`
- 0.00 MB: `.apkcheck-api-fixed/res/5D.9.png`, `.apkcheck-v2/res/5D.9.png`

## Secret Review Findings

Values are intentionally not printed.

| Path | Type | Risk | Evidence | Rotation required |
|---|---|---:|---|---|
| `backend/.env.example` | JWT secret assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/admin.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/create-admin.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/gdpr.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/@types/node/crypto.d.ts` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/dotenv/README-es.md` | Private key block | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/dotenv/README.md` | Private key block | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/gtoken/README.md` | Private key block | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/iconv-lite/lib/bom-handling.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/mysql2/lib/auth_plugins/caching_sha2_password.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/mysql2/lib/auth_plugins/mysql_clear_password.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/mysql2/lib/auth_plugins/mysql_native_password.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/mysql2/lib/auth_plugins/sha256_password.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/mysql2/lib/commands/change_user.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/mysql2/lib/commands/client_handshake.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/mysql2/lib/connection_config.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/mysql2/lib/packets/change_user.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/mysql2/lib/packets/handshake_response.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/nodemailer/lib/mailer/index.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/openai/node_modules/@types/node/crypto.d.ts` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/node_modules/whatwg-url/lib/url-state-machine.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend/server.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend_proxy_sample/.env.example` | JWT secret assignment | high | Pattern matched; value intentionally not included. | yes |
| `backend_proxy_sample/server.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |
| `build/reports/problems/problems-report.html` | OPENAI key | high | Pattern matched; value intentionally not included. | yes |
| `release/backend_sos_geo_update/server.js` | Password assignment | high | Pattern matched; value intentionally not included. | yes |

## Generated Directory Policy

- `.apkcheck-api-fixed/META-INF/com/android/build`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `.apkcheck-v2/META-INF/com/android/build`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `.dart_tool`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `.idea`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `android/.gradle`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `android/build`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/abort-controller/dist`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/agent-base/dist`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/data-uri-to-buffer/dist`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/event-target-shim/dist`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/fetch-blob/node_modules`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/fetch-blob/node_modules/web-streams-polyfill/dist`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/gaxios/build`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/gaxios/node_modules`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/gcp-metadata/build`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/google-auth-library/build`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/google-logging-utils/build`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/gtoken/build`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/https-proxy-agent/dist`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/https-proxy-agent/node_modules`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/jsonwebtoken/node_modules`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/mysql2/node_modules`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/openai/node_modules`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/qs/dist`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/send/node_modules`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `backend/node_modules/web-streams-polyfill/dist`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/generated/ap_generated_sources/debug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/compressed_assets/debug/compressDebugAssets/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/data_binding_layout_info_type_merge/debug/mergeDebugResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/data_binding_layout_info_type_package/debug/packageDebugResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/desugar_graph/debug/dexBuilderDebug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/external_libs_dex_archive/debug/dexBuilderDebug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/external_libs_dex_archive_with_artifact_transforms/debug/dexBuilderDebug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/global_synthetics_external_lib/debug/dexBuilderDebug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/global_synthetics_external_libs_artifact_transform/debug/dexBuilderDebug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/global_synthetics_mixed_scope/debug/dexBuilderDebug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/global_synthetics_project/debug/dexBuilderDebug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/global_synthetics_subproject/debug/dexBuilderDebug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/java_res/debug/processDebugJavaRes/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/merged_jni_libs/debug/mergeDebugJniLibFolders/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/merged_res_blame_folder/debug/mergeDebugResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/merged_test_only_native_libs/debug/mergeDebugNativeLibs/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/mixed_scope_dex_archive/debug/dexBuilderDebug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/project_dex_archive/debug/dexBuilderDebug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/stripped_native_libs/debug/stripDebugDebugSymbols/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/app/intermediates/sub_project_dex_archive/debug/dexBuilderDebug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/flutter_plugin_android_lifecycle/generated/ap_generated_sources/debug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/flutter_plugin_android_lifecycle/intermediates/compiled_local_resources/debug/compileDebugLibraryResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/flutter_plugin_android_lifecycle/intermediates/data_binding_layout_info_type_package/debug/packageDebugResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/flutter_plugin_android_lifecycle/intermediates/merged_jni_libs/debug/mergeDebugJniLibFolders/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/google_sign_in_android/generated/ap_generated_sources/debug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/google_sign_in_android/intermediates/compiled_local_resources/debug/compileDebugLibraryResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/google_sign_in_android/intermediates/data_binding_layout_info_type_package/debug/packageDebugResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/google_sign_in_android/intermediates/java_res/debug/processDebugJavaRes/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/google_sign_in_android/intermediates/merged_jni_libs/debug/mergeDebugJniLibFolders/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/image_picker_android/generated/ap_generated_sources/debug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/image_picker_android/intermediates/compiled_local_resources/debug/compileDebugLibraryResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/image_picker_android/intermediates/data_binding_layout_info_type_package/debug/packageDebugResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/image_picker_android/intermediates/java_res/debug/processDebugJavaRes/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/image_picker_android/intermediates/merged_jni_libs/debug/mergeDebugJniLibFolders/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/shared_preferences_android/generated/ap_generated_sources/debug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/shared_preferences_android/intermediates/compiled_local_resources/debug/compileDebugLibraryResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/shared_preferences_android/intermediates/data_binding_layout_info_type_package/debug/packageDebugResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/shared_preferences_android/intermediates/java_res/debug/processDebugJavaRes/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/shared_preferences_android/intermediates/merged_jni_libs/debug/mergeDebugJniLibFolders/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/sign_in_with_apple/intermediates/compiled_local_resources/debug/compileDebugLibraryResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/sign_in_with_apple/intermediates/data_binding_layout_info_type_package/debug/packageDebugResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/sign_in_with_apple/intermediates/java_res/debug/processDebugJavaRes/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/sign_in_with_apple/intermediates/merged_jni_libs/debug/mergeDebugJniLibFolders/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/test_cache/build`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/url_launcher_android/generated/ap_generated_sources/debug/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/url_launcher_android/intermediates/compiled_local_resources/debug/compileDebugLibraryResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/url_launcher_android/intermediates/data_binding_layout_info_type_package/debug/packageDebugResources/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/url_launcher_android/intermediates/java_res/debug/processDebugJavaRes/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.
- `build/url_launcher_android/intermediates/merged_jni_libs/debug/mergeDebugJniLibFolders/out`: Generated/local workspace output. Remove only after backup and approval; ensure .gitignore covers it.

## Next Step

Do not delete anything yet. Review this report, then approve specific cleanup groups. Each approved group should be removed in a separate commit after targeted tests.
