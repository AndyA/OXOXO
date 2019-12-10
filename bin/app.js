"use strict";

require("../lib/use");

const express = require("express");
require("express-async-errors");
const exphbs = require("express-handlebars");
const bodyParser = require("body-parser");
const config = require("config");
const Handlebars = require("handlebars");

const WEBROOT = "www";
const app = express();

app.engine(
  ".hbs",
  exphbs({
    defaultLayout: "main",
    extname: ".hbs",
    handlebars: Handlebars,
    compilerOptions: config.get("handlebars")
  })
);

app.set("view engine", ".hbs");

// Our Handlebars extensions
//require("handlebars/helpers")(Handlebars);

// TODO should this be here?
//app.use(bodyParser.json());

app.use(require("srv/views"));

app.use(express.static(WEBROOT));

app.listen(config.listen);
