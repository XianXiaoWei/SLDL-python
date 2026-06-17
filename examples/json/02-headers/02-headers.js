/**
 * Part of that-sky-project.
 * Copyright (c) 2026 That Sky Project
 * All rights reserved.
 * 
 * Examples: 02-headers
 *   Read and write complete .level.bin files with sldl-headers.
 */

const { DeclarationGroup, JsonLevelObjects, ItaniumResolver } = require("sldl-jsonify");
const { kLibStdSkyDecl } = require("sldl-headers");
const { Buffer } = require("buffer");
const fs = require("fs");
const pl = require("path");

var bin = fs.readFileSync(pl.join(__dirname, "HTNH_TheEnd.Objects.level.bin"));
var objects = new JsonLevelObjects(kLibStdSkyDecl);
var jsonify = objects.read(bin);

fs.writeFileSync(pl.join(__dirname, "HTNH_TheEnd.Objects.level.json"), JSON.stringify(jsonify, null, 2));
