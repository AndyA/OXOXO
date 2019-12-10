"use strict";

const { series, parallel, src, dest, watch } = require("gulp");
const babelify = require("babelify");
const terser = require("gulp-terser");
const browserify = require("browserify");
const watchify = require("watchify");
const sass = require("gulp-sass");
const source = require("vinyl-source-stream");
const buffer = require("vinyl-buffer");
const sourcemaps = require("gulp-sourcemaps");
const gls = require("gulp-live-server");
const log = require("gulplog");
const browserSync = require("browser-sync").create();
const mocha = require("gulp-mocha");
const path = require("path");
const paths = require("./paths");
const config = require("config");

const ENV = process.env.NODE_ENV || "production";

const wa = watchify.args;

function jsTransform(appSource, destDir, watch) {
  const o = {
    entries: appSource,
    paths: ["lib"],
    debug: ENV === "development"
  };

  if (watch) Object.assign(o, wa, { plugin: [watchify] });

  const b = browserify(o).transform("babelify", {
    presets: [["@babel/preset-env", { targets: "> 0.25%, not dead" }]],
    plugins: [["@babel/plugin-transform-runtime", { regenerator: true }]]
  });

  function bundle() {
    log.info(`Rebuilding ${appSource} for ${ENV}`);
    browserSync.notify(`Rebuilding ${appSource} for ${ENV}`);

    let pl = b
      .bundle()
      .on("error", log.error)
      .pipe(source(path.basename(appSource)))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }));

    if (ENV === "production") pl = pl.pipe(terser()).on("error", log.error);
    else if (ENV === "development") pl = pl.pipe(sourcemaps.write("./"));

    return pl.pipe(dest(destDir)).pipe(browserSync.stream());
  }

  if (watch)
    b.on("update", bundle).on("time", ms => {
      log.info(`Bundled ${appSource} for ${ENV} in ${ms / 1000}s`);
    });

  return bundle();
}

function js() {
  return jsTransform(paths.app.oxoxo.src, paths.app.oxoxo.dest, false);
}

function jsWatch() {
  return jsTransform(paths.app.oxoxo.src, paths.app.oxoxo.dest, true);
}

function scss() {
  return src(paths.scss.src)
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sass({ style: "compressed", includePaths: paths.scss.include }))
    .pipe(sourcemaps.write("./"))
    .pipe(dest(paths.scss.dest))
    .pipe(browserSync.stream());
}

async function watchFiles() {
  watch(paths.scss.watch, scss);
}

async function sync() {
  browserSync.init({
    proxy: `http://localhost:${config.listen}`,
    open: false,
    reloadDebounce: 2000,
    logConnections: true
    //    injectChanges: false
  });
}

async function runServer() {
  const server = gls("bin/app.js", { env: { NODE_ENV: ENV } }, false);

  server.start();

  async function reloadViews() {
    browserSync.reload();
  }

  async function reloadApp() {
    server.start();
    browserSync.reload();
  }

  watch(["views/**/*.hbs"], reloadViews);

  // watch only fires once if bin/app.js isn't a wildcard. See
  //   https://github.com/gulpjs/gulp/issues/2325
  watch(["bin/app.js*", "lib/**/*.js", "config/*"], reloadApp);
}

function test() {
  return src("test/**/*.js").pipe(mocha({ reporter: "spec" }));
}

async function tdd() {
  watch(["test/**/*.js", "lib/**/*.js"], test);
}

const build = parallel(js, scss);

module.exports = {
  js,
  scss,
  build,
  test,
  tdd,
  watch: series(parallel(jsWatch, scss), sync, runServer, watchFiles)
};
