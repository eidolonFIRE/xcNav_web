const path = require('path');

module.exports = {
  entry: "./ts/main.ts",
  mode: 'development',
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, 'dist/js')
  },
  // Enable sourcemaps for debugging webpack's output.
  devtool: "source-map",
  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: ["", ".webpack.js", ".web.js", ".ts", ".tsx", ".js"],
  },
  module: {
    rules: [
      // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
      { test: /\.tsx?$/, loader: "ts-loader" },
      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      { test: /\.js$/, loader: "source-map-loader" },

      // copy html / ico to ./dist output
      // in future this could be replaced by a minifier
    //   {
    //     test: /\.(html)$/i,
    //     use: [
    //       {
    //         loader: 'file-loader?name=[name].[ext]',
    //       }
    //     ]
    //   },

    //   // copy css
    //   {
    //     test: /\.css$/i,
    //     use: [
    //       {
    //         loader: 'style-loader',
    //       },
    //       {
    //         loader: 'file-loader',
    //         options: {
    //           name: 'css/[name].[ext]',
    //           publicPath: 'css',
    //           esModule: false,
    //         }
    //       }
    //     ]
    //   },

    //   // copy all images
    //   {
    //     test: /\.(png|svg|jpg|gif|ico)$/i,
    //     use: [
    //       { 
    //         loader: 'file-loader?name=[name].[ext]',
    //         options: {
    //           name: 'images/[name].[ext]',
    //           publicPath: 'images',
    //           esModule: false,
    //         }
    //       }
    //     ]
    //   },

    //   // copy all sounds
    //   {
    //     test: /\.(mp3)$/i,
    //     use: [
    //       { 
    //         loader: 'file-loader?name=[name].[ext]',
    //         options: {
    //           name: 'sounds/[name].[ext]',
    //           publicPath: 'sounds',
    //           esModule: false,
    //         }
    //       }
    //     ]
    //   }
    ],
  },
  // Other options...
  "mode": "development",
};