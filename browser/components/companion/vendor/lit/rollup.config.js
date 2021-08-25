import nodeResolve from '@rollup/plugin-node-resolve';

export default {
  input: "index.js",
  output: {
    file: "lit.all.js",
    format: "esm",
  },
  plugins: [
    nodeResolve({
      browser: true,
      exportConditions: ["development"],
    }),
  ],
};
