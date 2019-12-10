"use strict";

const express = require("express");

const app = express();

app.get("/", async (req, res) => {
  res.render("home", { title: "OXOXO" });
});

module.exports = app;
