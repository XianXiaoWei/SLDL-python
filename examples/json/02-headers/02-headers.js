/**
 * Part of that-sky-project.
 * Copyright (c) 2026 That Sky Project
 * All rights reserved.
 * 
 * Examples: 02-headers
 *   Read and write complete .level.bin files with sldl-headers.
 */

// Step 1: Import sldl-headers.
const { kLibStdSkyDecl } = require("sldl-headers");
const { JsonLevelObjects } = require("sldl-jsonify");
const fs = require("fs");
const pl = require("path");

var bin = fs.readFileSync(pl.join(__dirname, "HTNH_TheEnd.Objects.level.bin"));
// Step 2: Produce the declarations to JsonLevelObjects.
var objects = new JsonLevelObjects(kLibStdSkyDecl);
// Step 3: Read or write level objects.
var jsonify = objects.read(bin);

fs.writeFileSync(pl.join(__dirname, "HTNH_TheEnd.Objects.level.json"), JSON.stringify(jsonify, null, 2));
