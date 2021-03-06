/**
 * Created by Evrim Persembe on 8/31/16.
 */

/* global desc:true, task:true, fail:true, complete:true, jake:true, directory:true */

(function () {
  "use strict";

  var semver = require("semver");
  var jshint = require("simplebuild-jshint");
  var karma  = require("simplebuild-karma");
  var shell  = require("shelljs");
  var fs     = require("fs");

  var KARMA_CONFIG  = "karma.conf.js";
  var GENERATED_DIR = "generated";
  var DIST_DIR      = GENERATED_DIR + "/dist";
  var GH_PAGES_DIR  = "docs";

  /* General-purpose tasks */

  desc("Start the Karma server");
  task("karma", function() {
    console.log("Starting Karma server:");

    karma.start({
      configFile: KARMA_CONFIG
    }, complete, fail);
  }, { async: true });

  desc("Default build");
  task("default", [ "node_version", "lint", "test" ], function() {
    console.log("BUILD OK!");
  });

  desc("Run a local server");
  task("run", [ "build" ], function() {
    jake.exec("node node_modules/.bin/http-server " + DIST_DIR, { interactive: true });
  }, { async: true });

  desc("Erase all generated files");
  task("clean", function() {
    console.log("Erasing generated files: .");

    shell.rm("-rf", GENERATED_DIR);
  });

  /* Supporting tasks */

  desc("Check Node version");
  task("node_version", function() {
    console.log("Checking Node version: .");

    var packageJson     = require("./package.json");
    var expectedVersion = packageJson.engines.node;
    var actualVersion   = process.version;

    if (semver.neq(expectedVersion, actualVersion)) {
      fail("Incorrect Node version: expected " + expectedVersion + ", but was " + process.version + ".");
    }
  });

  desc("Lint the JavaScript code");
  task("lint", function() {
    process.stdout.write("Linting JavaScript: ");

    // Get the JSHint options from package.json so
    // we can use the same settings in JetBrains IDEs.
    var lintOptions = require("./package.json").jshintConfig;
    var lintGlobals = lintOptions.globals;

    jshint.checkFiles({
      files: [ "Jakefile.js", "src/javascript/**/*.js" ],
      options: lintOptions,
      globals: lintGlobals
    }, complete, fail);
  }, { async: true });

  desc("Run tests");
  task("test", function() {
    console.log("Testing JavaScript:");

    karma.run({
      configFile: KARMA_CONFIG,
      expectedBrowsers: [
        "Chrome 53.0.2785 (Mac OS X 10.12.0)",
        "Edge 14.14393.0 (Windows 10 0.0.0)",
        "Safari 10.0.0 (Mac OS X 10.12.0)",
        "Firefox 49.0.0 (Mac OS X 10.12.0)",
        "Mobile Safari 10.0.0 (iOS 10.0.0)"
      ],
      strict: !process.env.loose
    }, complete, fail);
  }, { async: true });

  desc("Build distribution directory");
  task("build", [ DIST_DIR ], function() {
    var cmds = ["node node_modules/.bin/browserify src/javascript/app.js -o " + DIST_DIR + "/bundle.js",
      "node node_modules/.bin/uglifyjs " + DIST_DIR + "/bundle.js " +
      "-o " + DIST_DIR + "/bundle.min.js " +
      "--source-map " + DIST_DIR + "/bundle.min.js.map " +
      "--source-map-url bundle.min.js.map " +
      "-p 2 -m -c --screw-ie8",
      "node node_modules/.bin/postcss --use autoprefixer --use cssnano -o generated/dist/style.css generated/dist/style.css",
      "node node_modules/.bin/html-minifier generated/dist/index.html -o generated/dist/index_min.html"];

    console.log("Building distribution directory: .");

    shell.rm("-rf", DIST_DIR + "/*");
    shell.cp("src/content/*", DIST_DIR);

    jake.exec(cmds,
      {interactive: true}, function() {
        shell.mv(DIST_DIR + "/index_min.html", DIST_DIR + "/index.html");

        complete();
      });
  }, { async: true });

  directory(DIST_DIR);

  desc("Build GitHub Pages");
  task("gh-pages", [ GH_PAGES_DIR ], function() {
    console.log("Building GitHub Pages directory: .");

    shell.rm("-rf", GH_PAGES_DIR + "/*");
    shell.cp(DIST_DIR + "/*", GH_PAGES_DIR);

    var indexHTML = fs.readFileSync(GH_PAGES_DIR + "/index.html", "utf8");
    var indexHTMLwithAnalytics = getHTMLWithAnalytics(indexHTML);

    fs.writeFile(GH_PAGES_DIR + "/index.html", indexHTMLwithAnalytics, "utf8");
  });

  directory(GH_PAGES_DIR);

  function getHTMLWithAnalytics(HTML) {
    var googleAnalyticsScriptTag = "<script>" +
      "(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){" +
      "    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o)," +
      "  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)" +
      "})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');" +
      "ga('create', 'UA-84971715-1', 'auto');" +
      "ga('send', 'pageview');" +
      "</script>\n";

    return HTML.replace("</body>", googleAnalyticsScriptTag + "</body>");
  }
}());