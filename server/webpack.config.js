const path = require('path');


module.exports = {
  entry: "./src/ts/main.ts",
  mode: 'development',
  target: 'node',
  output: {
    filename: "./js/[name].bundle.js",
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  // Enable sourcemaps for debugging webpack's output.
  devtool: "source-map",
  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: ["", ".webpack.js", ".web.js", ".ts", ".tsx", ".js"],
  },
  module: {
    // Help on loaders: https://webpack.js.org/loaders/html-loader/
    rules: [
      // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      { test: /\.js$/, loader: "source-map-loader" },
    ],
  },
  // Other options...
  "mode": "development",
};