import path from 'node:path'
import { fileURLToPath } from 'node:url'
import HtmlWebpackPlugin from 'html-webpack-plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
    entry: './src/main.jsx',
    mode: 'development',

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        clean: true,
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
                use: ['style-loader', 'css-loader'],
            },
        ],
    },

    resolve: {
        extensions: ['.js', '.jsx'],
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: './index.html',
        }),
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
    ]
}