module.exports = {
  plugins: {
    'postcss-import': {},
    'postcss-preset-env': {
      stage: 3,
      features: {
        'nesting-rules': true,
        'custom-media-queries': true,
        'custom-properties': false
      },
      autoprefixer: {
        grid: true,
        flexbox: true
      }
    },
    'postcss-nested': {},
    'postcss-custom-properties': {},
    'postcss-color-function': {},
    'cssnano': process.env.NODE_ENV === 'production' ? {
      preset: ['default', {
        discardComments: {
          removeAll: true,
        },
        normalizeWhitespace: true,
        colormin: true,
        minifySelectors: true,
        mergeRules: true
      }]
    } : false
  }
};