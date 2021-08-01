const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');


// Helpful guide: https://www.valentinog.com/blog/webpack/#working-with-html

module.exports = {
  entry: "./src/ts/main.ts",
  mode: 'development',
  output: {
    filename: "./js/[name].bundle.js",
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  devServer: {
    after: function (app, server, compiler) {
      // do fancy stuff
    },
    contentBase: path.join(__dirname, 'dist'),
    port: 8000,
  },
  // Enable sourcemaps for debugging webpack's output.
  devtool: "source-map",
  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: ["", ".webpack.js", ".web.js", ".ts", ".tsx", ".js"],
  },
  // Create entry-point html file
  plugins: [
    new HtmlWebpackPlugin({
      title: 'xcNav (Development)',
      template: path.resolve(__dirname, "src", "index.html")
    }),
  ],
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

      // html loader
      {
        test: /\.html$/i,
        loader: 'html-loader',
      },

      // compile out css
      {
        test: /\.css$/i,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
          },
        ]
      },
      // copy out all assets
      {
        test: /\.(png|svg|jpg|jpeg|gif|ico)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][hash][ext][query]'
        }
      },
      {
        test: /\.(mp3)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'sounds/[name][hash][ext][query]'
        }
      },
      {
        test: /\.(eot|ttf|woff|woff2)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][hash][ext][query]'
        }
      },

    ],
  },
};