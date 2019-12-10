"use strict";

module.exports = {
  app: {
    oxoxo: {
      src: "lib/app/oxoxo.js",
      dest: "www/js"
    }
  },
  scss: {
    src: "lib/app/**/*.{sass,scss}",
    dest: "www/css",
    include: ["lib/sass", "node_modules"],
    watch: ["lib/**/*.{sass,scss}"]
  }
};
