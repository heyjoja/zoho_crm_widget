import path from 'node:path'
import { fileURLToPath } from 'node:url'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isProduction = process.env.NODE_ENV === 'production'

export default {
    entry: './src/main.jsx',
    mode: isProduction ? 'production' : 'development',

    output: {
        path: path.resolve(__dirname, '../contacts/app'),
        filename: 'js/[name].[contenthash].js',
        chunkFilename: 'js/[name].[contenthash].chunk.js',
        clean: true,
    },

    optimization: {
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                // Split React into its own chunk
                react: {
                    test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                    name: 'react-vendor',
                    chunks: 'all',
                    priority: 20,
                },
                // Split maplibre-gl into its own chunk (it's the heaviest dependency)
                maplibre: {
                    test: /[\\/]node_modules[\\/]maplibre-gl[\\/]/,
                    name: 'maplibre-vendor',
                    chunks: 'all',
                    priority: 10,
                },
                // All other node_modules into a common vendor chunk
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
                    priority: 5,
                },
            },
        },
    },

    performance: {
        // Raise the warning threshold to avoid false alarms for heavy libraries like maplibre-gl
        maxAssetSize: 2 * 1024 * 1024,       // 2 MiB per asset
        maxEntrypointSize: 2 * 1024 * 1024,   // 2 MiB per entrypoint
        hints: 'warning',
    },

    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', { targets: 'defaults' }],
                            ['@babel/preset-react', { runtime: 'automatic' }],
                        ],
                    },
                },
            },
            {
                test: /\.css$/,
                use: [
                    // Extract CSS to separate file in production, inject via JS in dev
                    isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
                    'css-loader',
                ],
            },
        ],
    },

    resolve: {
        extensions: ['.js', '.jsx'],
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: './index.html',
            filename: 'index.html',
        }),
        ...(isProduction
            ? [
                new MiniCssExtractPlugin({
                    filename: 'css/styles.[contenthash].css',
                }),
            ]
            : []),
    ],

    devServer: {
        port: 3000,
        hot: true,
        historyApiFallback: true,
    },

    ignoreWarnings: [
        {
            module: /maplibre-gl[\\/]dist[\\/]maplibre-gl\.mjs/,
            message: /Critical dependency: the request of a dependency is an expression/,
        },
    ],
}