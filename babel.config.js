module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      // zustand v5's middleware bundle contains `import.meta`, which a classic
      // browser <script> rejects; without this the web app never starts. Native
      // bundles resolve the CommonJS build, so the option is web-only.
      ["babel-preset-expo", { web: { unstable_transformImportMeta: true } }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
