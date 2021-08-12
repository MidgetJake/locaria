const path = require('path');

module.exports = {
	mode: 'development',
	entry: {
		full:'./src/locus/index.js'
	},
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'site/dist'),
		assetModuleFilename: 'other/[hash][ext][query]'
	},
	module: {
		rules: [
			{
				test: /\.(svg|png)$/i,
				type: 'asset/resource',
				generator: {
					filename: 'images/[hash][ext][query]'
				}
			},
			{
				test: /\.(ttf|otf)$/i,
				type: 'asset/resource',
				generator: {
					filename: 'fonts/[hash][ext][query]'
				}
			},
			{
				test: /\.(js)$/,
				exclude: /node_modules/,
				use: ['babel-loader']
			},
			{
				test: /\.css$/i,
				use: ['style-loader', 'css-loader'],
			},
			{
				test: /\.less$/,
				use: [
					{
						loader: 'style-loader'
					},
					{
						loader: 'css-loader',
						options: {
							sourceMap: true,
						},
					},
					{
						loader: 'less-loader',
						options: {
							lessOptions: {
								sourceMap: true
							},
						},
					},
				],
			}
		]
	},
	resolve: {
		fallback: {
			util: require.resolve('util/')
			}
	},
	devServer: {
		contentBase: path.join(__dirname, 'site'),
		compress: true,
		port: 8080,
		historyApiFallback: {
			index: 'index.html'
		}
	}
};