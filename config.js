"use strict";

exports.DATABASE_URL =
  process.env.DATABASE_URL || "mongodb://localhost/blog-app";
exports.PORT = process.env.PORT || 8080;
