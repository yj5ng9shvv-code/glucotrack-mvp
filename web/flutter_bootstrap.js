{{flutter_js}}
{{flutter_build_config}}

// Keep the stable Flutter filenames on disk while forcing browsers to fetch
// the current executable after each deployment.
for (const build of _flutter.buildConfig.builds) {
  if (build.mainJsPath === 'main.dart.js') {
    build.mainJsPath = 'main.dart.js?v=20260709-allergy-status-3';
  }
}

_flutter.loader.load();
