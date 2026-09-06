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
        filename: 'js/[name].[contenthash].js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },

    optimization: {
        runtimeChunk: 'single',
        ...(isProduction && {
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    react: {
                        test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                        name: 'react-vendor',
                        chunks: 'all',
                        priority: 20,
                    },
                    maplibre: {
                        test: /[\\/]node_modules[\\/]maplibre-gl[\\/]/,
                        name: 'maplibre-vendor',
                        chunks: 'all',
                        priority: 10,
                    },
                    vendors: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendors',
                        chunks: 'all',
                        priority: 5,
                    },
                },
            },
        }),
    },

    performance: isProduction
        ? {
            maxAssetSize: 2 * 1024 * 1024,
            maxEntrypointSize: 2 * 1024 * 1024,
            hints: 'warning',
        }
        : false,

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
            template: './public/index.html', // ← Now points to the correct file
            filename: 'index.html',
            inject: 'body',
            scriptLoading: 'blocking',
        }),
        ...(isProduction
            ? [new MiniCssExtractPlugin({
                filename: 'css/styles.[contenthash].css',
            })]
            : []),
    ],

    devServer: {
        port: 3000,
        hot: true,
        historyApiFallback: true,
        static: {
            directory: path.resolve(__dirname, 'public'), // ← Serve public assets in dev
        },
    },

    ignoreWarnings: [
        {
            module: /maplibre-gl[\\/]dist[\\/]maplibre-gl\.mjs/,
            message: /Critical dependency: the request of a dependency is an expression/,
        },
    ],
}