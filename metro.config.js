const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// On web, Metro resolves `tslib` (pulled in by @supabase/* and pdf-lib) to its
// `modules/index.js` Node wrapper, which does `import tslib from "../tslib.js"`
// and then destructures `.default`. That default is undefined in a Metro bundle,
// so the whole web app crashes on start-up ("Cannot destructure property
// '__extends' of ... as it is undefined"). Use tslib's plain ES build instead,
// resolved from the importing package so each keeps its own tslib version.
// Native bundles resolve the CommonJS build and are left alone.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "tslib") {
    // Resolve the package's main file, then step to the ES build beside it:
    // tslib 1.x does not export the `tslib.es6.js` sub-path.
    const main = require.resolve("tslib", {
      paths: [path.dirname(context.originModulePath)],
    });
    return {
      filePath: path.join(path.dirname(main), "tslib.es6.js"),
      type: "sourceFile",
    };
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform,
  );
};

module.exports = withNativeWind(config, { input: "./src/theme/global.css" });
