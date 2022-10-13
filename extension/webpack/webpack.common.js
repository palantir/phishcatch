// Copyright 2021 Palantir Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const path = require('path')
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin')
const srcDir = '../src/'

module.exports = {
  entry: {
    popup: path.join(__dirname, srcDir + 'popup.tsx'),
    background: path.join(__dirname, srcDir + 'background.ts'),
    content: path.join(__dirname, srcDir + 'content.ts'),
  },
  output: {
    path: path.join(__dirname, '../dist/js'),
    filename: '[name].js',
    hashFunction: 'xxhash64',
  },
  optimization: {
    splitChunks: {
      name: 'vendor',
      chunks: 'initial',
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    fallback: {
      "buffer": require.resolve('buffer/'),
      'util': require.resolve('util/')
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new CopyPlugin({
      // patterns: [{ from: './public/', to: './' }],
      patterns: [{ from: '.', to: '../', context: 'public' }],
      options: {},
    }),
  ],
}
