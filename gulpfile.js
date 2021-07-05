'use strict';

const path = require('path');

const { src, pipe, dest, series, parallel, watch } = require('gulp');
const Fiber = require('fibers');
const rollup = require('rollup');
const rollupPluginCommonjs = require('@rollup/plugin-commonjs');
const rollupPluginNodeResolve = require('@rollup/plugin-node-resolve');
const rollupPluginTerser = require('rollup-plugin-terser').terser;

const plugins = {}
plugins.sass = require('gulp-sass');
plugins.gulpStylelint = require('gulp-stylelint');
plugins.gulpif = require('gulp-if');
plugins.postcss = require('gulp-postcss');
plugins.hash = require('gulp-sha256-filename');


const paths = {
  src: 'src/assets/',
  node_modules: 'node_modules/',
  dist: 'dist/alerts/assets/',
  govuk_frontend: 'node_modules/govuk-frontend/',
  assetsUrl: '/alerts/assets/'
};

const hashOptions = { format: '{name}-{hash:8}{ext}' }

plugins.sass.compiler = require('sass');

const copy = {
  govuk_frontend: {
    fonts: () => {
      return src(paths.govuk_frontend + 'govuk/assets/fonts/**/*')
        .pipe(dest(paths.dist + 'fonts/'));
        // Fonts have their own filename hash so we don’t need to add
        // our own
    },
    images: () => {
      return src(paths.govuk_frontend + 'govuk/assets/images/**/*')
        // A few images used by GOVUK Frontend components can't have hashes added to their
        // URLs so we can't change their filenames
        .pipe(plugins.gulpif(
          (file) => {
            return [
              'govuk-crest-2x.png',
              'govuk-crest.png',
              'govuk-logotype-crown.png'
            ].includes(path.basename(file.path)) === false;
          },
          plugins.hash(hashOptions)
        ))
        .pipe(dest(paths.dist + 'images/'));
    }
  },
  html5shiv: () => {
    return src(paths.node_modules + 'html5shiv/dist/*.min.js')
      .pipe(plugins.hash(hashOptions))
      .pipe(dest(paths.dist + 'javascripts/vendor/html5shiv/'));
  },
  images: () => {
      return src(paths.src + 'images/**/*')
        .pipe(plugins.hash(hashOptions))
        .pipe(dest(paths.dist + 'images/'));
  }
};

const rollupTask = (fileName) => () => {
  return rollup.rollup({
  // Use Rollup to combine all JS in JS module format into a Immediately Invoked Function
  // Expression (IIFE) to:
  // - deliver it in one bundle
  // - allow it to run in browsers without support for JS Modules
    input: {
      [fileName]: paths.src + 'javascripts/' + fileName + '-init.mjs'
    },
    plugins: [
      // determine module entry points from either 'module' or 'main' fields in package.json
      rollupPluginNodeResolve.nodeResolve({
        mainFields: ['module', 'main']
      }),
      // gulp rollup runs on nodeJS so reads modules in commonJS format
      // this adds node_modules to the require path so it can find the GOVUK Frontend modules
      rollupPluginCommonjs({
        include: 'node_modules/**'
      }),
      // Terser is a replacement for UglifyJS
      rollupPluginTerser()
    ]
  }).then(bundle => {
    return bundle.write({
      dir: paths.dist + 'javascripts/',
      entryFileNames: '[name]-[hash].js',
      format: 'iife',
      name: 'GOVUK',
      sourcemap: true
    });
  });
};

const scss = {
  compile: () => {
    return src(paths.src + 'stylesheets/**/*.scss')
      .pipe(plugins.sass(
        {
          fiber: Fiber,
          includePaths: [paths.govuk_frontend],
          outputStyle: 'compressed'
        })
        .on('error', plugins.sass.logError))
        .pipe(plugins.gulpif(
          (file) => {
            return path.basename(file.path) === 'main-ie8.css';
          },
          plugins.postcss([require('oldie')()])
        ))
      .pipe(plugins.hash(hashOptions))
      .pipe(dest(paths.dist + 'stylesheets/'));
  }
};

const defaultTask = parallel(
  copy.govuk_frontend.fonts,
  copy.govuk_frontend.images,
  copy.html5shiv,
  copy.images,
  scss.compile,
  rollupTask('govuk-frontend-details'),
  rollupTask('sharing-button'),
  rollupTask('relative-dates')
);

exports.default = defaultTask;
