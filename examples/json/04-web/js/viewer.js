/**
 * viewer.js - ObjectsViewer for .level.bin files.
 *
 * Part of that-sky-project.
 * Copyright (c) 2026 That Sky Project
 * All rights reserved.
 */

// ---- Header Parser ------------------------------------------------------

/**
 * Parse the 44-byte TGCL header from a buffer.
 * Returns null if magic is invalid or buffer too small.
 * @param {Uint8Array} buffer
 * @returns {Object|null}
 */
function parseHeader(buffer) {
  if (buffer.length < 44)
    return null;

  var dtv = new DataView(buffer.buffer);
  var magic = String.fromCharCode(
    buffer[0], buffer[1], buffer[2], buffer[3]);
  if (magic !== 'TGCL')
    return null;

  return {
    magic: magic,
    version: dtv.getUint32(4, true),
    numClasses: dtv.getUint32(8, true),
    numMemVars: dtv.getUint32(12, true),
    numObjects: dtv.getUint32(16, true),
    numRefs: dtv.getUint32(20, true),
    classesOffset: dtv.getUint32(24, true),
    memvarsOffset: dtv.getUint32(28, true),
    stringsOffset: dtv.getUint32(32, true),
    objectsOffset: dtv.getUint32(36, true),
    fileSize: dtv.getUint32(40, true)
  };
}

// ---- Helpers ------------------------------------------------------------

/**
 * Type-group colour palette.  Deterministic colour from a string hash.
 */
var TYPE_COLORS = [
  '#7c83ff', '#4fc3f7', '#a5d6a7', '#ffcc80', '#ef9a9a',
  '#ce93d8', '#80cbc4', '#fff176', '#90caf9', '#f48fb1',
  '#a1887f', '#bcaaa4', '#81d4fa', '#c5e1a5', '#ffab91'
];

function typeColor(typeName) {
  var hash = 0;
  for (var i = 0; i < typeName.length; i++)
    hash = ((hash << 5) - hash + typeName.charCodeAt(i)) | 0;
  return TYPE_COLORS[Math.abs(hash) % TYPE_COLORS.length];
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

// ---- ObjectsViewer Class ------------------------------------------------

/**
 * Main viewer controller.
 * @constructor
 */
function ObjectsViewer() {
  this.fileName = '';
  this.fileSize = 0;
  this.header = null;
  this.objects = null;
  this.declarations = null;
  this.hasDeclarations = false;
  this.selectedObjectName = '';
  this.selectedObjectKey = '';
  this.typeGroups = {};
  this.collapsedTypes = {};
  this.jsonLevelObjects = null;
  this.dom = {};
}

ObjectsViewer.prototype = {

  // -- Initialisation -----------------------------------------------------

  /**
   * Cache DOM references, bind events.
   */
  init: function () {
    var self = this;

    // Cache DOM.
    var ids = [
      'file-input', 'drop-overlay', 'viewer-header', 'file-info',
      'btn-load-sample', 'btn-open-file', 'tree-content', 'tree-count',
      'tree-empty', 'detail-object-name', 'detail-object-type',
      'prop-tbody', 'json-view', 'status-text', 'decl-content',
      'decl-count', 'decl-header', 'decl-arrow'
    ];
    for (var i = 0; i < ids.length; i++)
      self.dom[ids[i].replace(/-([a-z])/g, function (m, c) {
        return c.toUpperCase();
      })] = document.getElementById(ids[i]);

    // Bind file input.
    self.dom.fileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0])
        self.handleDrop(e.target.files[0]);
      e.target.value = '';
    });

    self.dom.btnOpenFile.addEventListener('click', function () {
      self.dom.fileInput.click();
    });

    // Bind Load Sample.
    self.dom.btnLoadSample.addEventListener('click', function () {
      self.loadSample();
    });

    // Bind radio buttons.
    var radios = document.getElementsByName('decl-mode');
    for (var r = 0; r < radios.length; r++) {
      radios[r].addEventListener('change', function () {
        // If a file is loaded, reload with new mode.
        if (self.header)
          self.reloadWithMode();
      });
    }

    // Bind declaration section toggle.
    self.dom.declHeader.addEventListener('click', function () {
      var content = document.getElementById('decl-content');
      var arrow = self.dom.declArrow;
      if (content.style.display === 'none') {
        content.style.display = 'block';
        if (arrow) arrow.classList.add('expanded');
      } else {
        content.style.display = 'none';
        if (arrow) arrow.classList.remove('expanded');
      }
    });

    // Bind tab buttons.
    var tabBtns = document.querySelectorAll('.tab-btn');
    for (var t = 0; t < tabBtns.length; t++) {
      tabBtns[t].addEventListener('click', function () {
        var tabName = this.getAttribute('data-tab');
        self.switchTab(tabName);
      });
    }

    // Bind drag-and-drop on the whole page.
    var dropOverlay = self.dom.dropOverlay;
    var dragCounter = 0;

    document.addEventListener('dragenter', function (e) {
      e.preventDefault();
      dragCounter++;
      if (dragCounter === 1)
        dropOverlay.classList.add('active');
    });

    document.addEventListener('dragleave', function (e) {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropOverlay.classList.remove('active');
      }
    });

    document.addEventListener('dragover', function (e) {
      e.preventDefault();
    });

    document.addEventListener('drop', function (e) {
      e.preventDefault();
      dragCounter = 0;
      dropOverlay.classList.remove('active');
      if (e.dataTransfer.files && e.dataTransfer.files[0])
        self.handleDrop(e.dataTransfer.files[0]);
    });
  },

  // -- Tab switching ------------------------------------------------------

  switchTab: function (tabName) {
    var btns = document.querySelectorAll('.tab-btn');
    var contents = document.querySelectorAll('.tab-content');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('data-tab') === tabName)
        btns[i].classList.add('active');
      else
        btns[i].classList.remove('active');
    }
    for (var j = 0; j < contents.length; j++) {
      if (contents[j].id === 'tab-' + tabName)
        contents[j].classList.add('active');
      else
        contents[j].classList.remove('active');
    }
  },

  // -- File handling ------------------------------------------------------

  /**
   * Load the sample .bin file bundled with this example.
   */
  loadSample: function () {
    var self = this;
    self.updateStatus('Loading sample...', 'info');

    fetch('blob/HTNH_TheEnd.Objects.level.bin')
      .then(function (response) {
        if (!response.ok)
          throw new Error('Failed to fetch sample: ' + response.status);
        return response.arrayBuffer();
      })
      .then(function (arrayBuffer) {
        self.fileName = 'HTNH_TheEnd.Objects.level.bin';
        self.fileSize = arrayBuffer.byteLength;
        self.loadFromBuffer(new Uint8Array(arrayBuffer), self.getDeclarationMode());
      })
      .catch(function (err) {
        self.updateStatus('Error loading sample: ' + err.message, 'error');
      });
  },

  /**
   * Handle a file from drop or file input.
   * @param {File} file
   */
  handleDrop: function (file) {
    var self = this;
    if (!file) return;

    if (!/\.(bin|level\.bin)$/i.test(file.name)) {
      self.updateStatus('Please drop a .level.bin file.', 'error');
      return;
    }

    self.fileName = file.name;
    self.fileSize = file.size;
    self.updateStatus('Reading file...', 'info');

    var reader = new FileReader();
    reader.onload = function (e) {
      var arrayBuffer = e.target.result;
      self.loadFromBuffer(new Uint8Array(arrayBuffer), self.getDeclarationMode());
    };
    reader.onerror = function () {
      self.updateStatus('Failed to read file.', 'error');
    };
    reader.readAsArrayBuffer(file);
  },

  /**
   * Get the current declaration mode from radio buttons.
   * @returns {boolean} true = use standard headers.
   */
  getDeclarationMode: function () {
    var radios = document.getElementsByName('decl-mode');
    for (var i = 0; i < radios.length; i++)
      if (radios[i].checked)
        return radios[i].value === 'headers';
    return false;
  },

  /**
   * Reload the last buffer with the current declaration mode.
   */
  reloadWithMode: function () {
    // We need the raw buffer.  Re-fetching requires re-reading the file,
    // which we cannot do from File without re-dropping.  Show a hint.
    this.updateStatus(
      'Mode changed. Load a file to apply the new setting.', 'info');
    this.header = null;
    this.objects = null;
    this.declarations = null;
    this.typeGroups = {};
    this.selectedObjectName = '';
    this.renderTree();
    this.renderDetail();
    this.updateHeaderInfo();
  },

  // -- Core loading -------------------------------------------------------

  /**
   * Parse a TGCL buffer and populate all state, then render.
   * @param {Uint8Array} buffer
   * @param {boolean} withDeclarations - use kLibStdSkyDecl if true.
   */
  loadFromBuffer: function (buffer, withDeclarations) {
    var self = this;

    // Parse header.
    self.header = parseHeader(buffer);
    if (!self.header) {
      self.updateStatus('Invalid TGCL file (bad magic or too small).',
        'error');
      return;
    }

    // Verify SLDL is available.
    if (typeof window.SLDL === 'undefined'
      || typeof window.SLDL.JsonLevelObjects === 'undefined') {
      self.updateStatus(
        'SLDL runtime not loaded. Check CDN script availability.', 'error');
      return;
    }

    // Create JsonLevelObjects and read.
    try {
      var declSrc = withDeclarations
        && typeof window.SLDL.LibStdSky.kLibStdSkyDecl !== 'undefined'
        ? window.SLDL.LibStdSky.kLibStdSkyDecl
        : {};
      self.jsonLevelObjects = new window.SLDL.JsonLevelObjects(declSrc);
      self.objects = self.jsonLevelObjects.read(buffer);
      self.declarations = self.jsonLevelObjects.getDeclGroup(true);
      self.hasDeclarations = withDeclarations
        && typeof window.SLDL.kLibStdSkyDecl !== 'undefined';
    } catch (e) {
      self.updateStatus('Parse error: ' + e.message, 'error');
      console.error(e);
      return;
    }

    // Group objects by $type.
    self.typeGroups = {};
    var objKeys = Object.keys(self.objects);
    for (var i = 0; i < objKeys.length; i++) {
      var key = objKeys[i];
      var obj = self.objects[key];
      var typeName = (obj && obj.$type) ? obj.$type : 'Unknown';
      if (!self.typeGroups[typeName])
        self.typeGroups[typeName] = [];
      self.typeGroups[typeName].push(key);
    }

    // Initialise collapse state (all collapsed).
    self.collapsedTypes = {};
    var typeNames = Object.keys(self.typeGroups);
    for (var j = 0; j < typeNames.length; j++)
      self.collapsedTypes[typeNames[j]] = true;

    // Render.
    self.updateHeaderInfo();
    self.renderTree();
    self.updateStatus(
      'Loaded ' + objKeys.length + ' objects in '
      + typeNames.length + ' types.', 'success');

    // Auto-select first object.
    if (objKeys.length > 0)
      self.selectObject(objKeys[0]);
    else
      self.renderDetail();
  },

  // -- Header info --------------------------------------------------------

  updateHeaderInfo: function () {
    var h = this.header;
    if (!h) {
      this.dom.fileInfo.textContent = 'No file loaded.';
      return;
    }
    var objCount = this.objects ? Object.keys(this.objects).length : 0;
    this.dom.fileInfo.textContent =
      this.fileName + ' | ' + formatSize(this.fileSize) + ' | '
      + 'v' + h.version + ' | '
      + objCount + ' objects | '
      + h.numClasses + ' classes | '
      + h.numMemVars + ' memvars';
  },

  // -- Tree rendering -----------------------------------------------------

  renderTree: function () {
    var self = this;
    var container = self.dom.treeContent;
    var isEmpty = !self.objects || Object.keys(self.objects).length === 0;

    container.innerHTML = '';

    if (isEmpty) {
      var emptyDiv = document.createElement('div');
      emptyDiv.id = 'tree-empty';
      emptyDiv.textContent =
        'Drop a .level.bin file or click "Load Sample" to begin.';
      container.appendChild(emptyDiv);
      self.dom.treeCount.textContent = '';
      self.renderDeclarations();
      return;
    }

    self.dom.treeCount.textContent =
      '(' + Object.keys(self.objects).length + ')';

    // Sort type groups alphabetically.
    var typeNames = Object.keys(self.typeGroups).sort();

    for (var t = 0; t < typeNames.length; t++) {
      var typeName = typeNames[t];
      var keys = self.typeGroups[typeName];
      var isCollapsed = self.collapsedTypes[typeName];

      // Type group container.
      var groupDiv = document.createElement('div');
      groupDiv.className = 'tree-type-group';

      // Type header.
      var headerDiv = document.createElement('div');
      headerDiv.className = 'tree-type-header';
      headerDiv.addEventListener('click',
        self.makeToggleTypeGroup(typeName));

      var arrow = document.createElement('span');
      arrow.className = 'tree-type-arrow'
        + (isCollapsed ? '' : ' expanded');
      arrow.innerHTML = '&#9654;';

      var nameSpan = document.createElement('span');
      nameSpan.className = 'tree-type-name';
      nameSpan.textContent = typeName;

      var countSpan = document.createElement('span');
      countSpan.className = 'tree-type-count';
      countSpan.textContent = String(keys.length);

      headerDiv.appendChild(arrow);
      headerDiv.appendChild(nameSpan);
      headerDiv.appendChild(countSpan);
      groupDiv.appendChild(headerDiv);

      // Object entries.
      var itemsDiv = document.createElement('div');
      itemsDiv.className = 'tree-type-items'
        + (isCollapsed ? ' collapsed' : '');
      // Set max-height for animation after measurment.
      // Default: large enough for typical groups.
      itemsDiv.style.maxHeight = isCollapsed
        ? '0px' : (keys.length * 28 + 4) + 'px';

      var color = typeColor(typeName);

      groupDiv.appendChild(itemsDiv);
      container.appendChild(groupDiv);

      if (isCollapsed)
        continue;

      for (var k = 0; k < keys.length; k++) {
        var objKey = keys[k];
        var entryDiv = document.createElement('div');
        entryDiv.className = 'tree-object-entry';
        if (objKey === self.selectedObjectKey)
          entryDiv.classList.add('selected');
        entryDiv.addEventListener('click',
          self.makeSelectObject(objKey));

        var dot = document.createElement('span');
        dot.className = 'tree-object-dot';
        dot.style.background = color;

        // Strip "O$" prefix if present.
        var displayName = objKey;
        if (displayName.indexOf('O$') === 0)
          displayName = displayName.substring(2);

        var nameEl = document.createElement('span');
        nameEl.className = 'tree-object-name';
        nameEl.textContent = displayName;

        entryDiv.appendChild(dot);
        entryDiv.appendChild(nameEl);
        itemsDiv.appendChild(entryDiv);
      }
    }

    self.renderDeclarations();
  },

  /**
   * Create a closure for toggleTypeGroup.
   */
  makeToggleTypeGroup: function (typeName) {
    var self = this;
    return function () {
      self.toggleTypeGroup(typeName);
    };
  },

  /**
   * Create a closure for selectObject.
   */
  makeSelectObject: function (objKey) {
    var self = this;
    return function () {
      self.selectObject(objKey);
    };
  },

  toggleTypeGroup: function (typeName) {
    this.collapsedTypes[typeName] = !this.collapsedTypes[typeName];
    this.renderTree();
  },

  // -- Declaration summary ------------------------------------------------

  renderDeclarations: function () {
    var self = this;
    var content = self.dom.declContent;
    content.innerHTML = '';

    if (!self.declarations) {
      self.dom.declCount.textContent = '';
      return;
    }

    var keys = Object.keys(self.declarations).sort();
    self.dom.declCount.textContent = '(' + keys.length + ')';

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var value = self.declarations[key];

      var entryDiv = document.createElement('div');
      entryDiv.className = 'decl-entry';

      var keySpan = document.createElement('span');
      keySpan.className = 'decl-key';
      keySpan.textContent = key;

      entryDiv.appendChild(keySpan);

      if (typeof value === 'string') {
        entryDiv.appendChild(document.createTextNode(' = ' + value));
      } else if (typeof value === 'object' && value !== null) {
        // Show $parent if present.
        var parts = [];
        if (value.$parent)
          parts.push('extends ' + value.$parent);
        var memberKeys = Object.keys(value).filter(function (k) {
          return k.charAt(0) !== '$';
        });
        if (memberKeys.length > 0)
          parts.push(memberKeys.length + ' members');
        if (parts.length > 0)
          entryDiv.appendChild(document.createTextNode(
            ' (' + parts.join(', ') + ')'));
      }

      content.appendChild(entryDiv);
    }
  },

  // -- Object selection ---------------------------------------------------

  selectObject: function (objKey) {
    this.selectedObjectKey = objKey;
    this.selectedObjectName = objKey;
    if (objKey.indexOf('O$') === 0)
      this.selectedObjectName = objKey.substring(2);

    // Update tree highlight.
    var entries = document.querySelectorAll('.tree-object-entry');
    for (var i = 0; i < entries.length; i++)
      entries[i].classList.remove('selected');
    // Find the matching entry by scanning after render.
    this.renderTree();

    // Render detail.
    this.renderDetail();
  },

  // -- Detail rendering ---------------------------------------------------

  renderDetail: function () {
    var self = this;
    var objKey = self.selectedObjectKey;
    var obj = self.objects ? self.objects[objKey] : null;

    // Update header.
    var nameEl = self.dom.detailObjectName;
    var typeEl = self.dom.detailObjectType;

    if (!obj) {
      nameEl.textContent = '';
      typeEl.textContent = '';
      self.dom.propTbody.innerHTML = '';
      self.dom.jsonView.textContent = '';
      return;
    }

    nameEl.textContent = self.selectedObjectName;
    typeEl.textContent = obj.$type || 'Unknown';

    // Build properties table.
    var tbody = self.dom.propTbody;
    tbody.innerHTML = '';

    var decl = self.declarations
      ? (self.declarations['C$' + obj.$type]
        || self.declarations['S$' + obj.$type])
      : null;

    var propKeys = Object.keys(obj).filter(function (k) {
      return k !== '$type';
    });
    propKeys.sort();

    for (var i = 0; i < propKeys.length; i++) {
      var propName = propKeys[i];
      var value = obj[propName];
      var typeHint = decl ? decl[propName] : null;
      self.renderPropertyRow(tbody, propName, value, typeHint, 0);
    }

    if (propKeys.length === 0)
      tbody.innerHTML = '<tr><td colspan="3" class="detail-empty">'
        + 'No properties.</td></tr>';

    // Build raw JSON.
    self.dom.jsonView.textContent = JSON.stringify(obj, null, 2);
  },

  /**
   * Render a single property row (recursive for nested structs).
   * @param {HTMLElement} tbody
   * @param {string} name
   * @param {*} value
   * @param {string|null} typeHint
   * @param {number} depth - nesting depth for indentation.
   */
  renderPropertyRow: function (tbody, name, value, typeHint, depth) {
    var tr = document.createElement('tr');
    if (depth > 0)
      tr.className = 'prop-row-nested';

    tbody.appendChild(tr);

    // Property name.
    var tdName = document.createElement('td');
    tdName.className = 'col-name';
    tdName.innerText = name;
    if (depth)
      tdName.style.textIndent = depth + "em";
    tr.appendChild(tdName);

    // Type hint.
    var tdType = document.createElement('td');
    tdType.className = 'col-type';
    tdType.textContent = typeHint || '';
    tr.appendChild(tdType);

    // Value.
    var tdValue = document.createElement('td');
    var pendingChild = [];
    tdValue.className = 'col-value';
    this.formatValueCell(tbody, tdValue, value, typeHint, depth, name);
    tr.appendChild(tdValue);
  },

  /**
   * Populate a table cell with a formatted value.
   * Nested objects are recursively handled.
   */
  formatValueCell: function (tbody, tdValue, value, typeHint, depth, name) {
    var self = this;

    // null / undefined.
    if (value === null || value === undefined) {
      tdValue.innerHTML = '<span class="prop-value-null">null</span>';
      return;
    }

    // Array.
    if (Array.isArray(value)) {
      if (value.length === 0) {
        tdValue.textContent = '[]';
        return;
      }
      var span = document.createElement('span');
      span.className = 'prop-value-array';
      var parts = [];
      for (var i = 0; i < Math.min(value.length, 8); i++) {
        var item = value[i];
        parts.push(self.formatValueInline(item));
      }
      span.textContent = '[' + parts.join(', ');
      if (value.length > 8)
        span.textContent += ', ...';
      span.textContent += '] (' + value.length + ' items)';
      tdValue.appendChild(span);
      return;
    }

    // Object (nested struct or class).
    if (typeof value === 'object') {
      // Show summary in parent, then recurse for children.
      tdValue.innerHTML =
        '<span class="prop-value-struct">{...}</span>';

      var childKeys = Object.keys(value);
      for (var c = 0; c < childKeys.length; c++) {
        var childName = childKeys[c];
        var childValue = value[childName];
        // Build a dotted type hint.
        var childTypeHint = null;
        var childDecl = self.declarations["S$" + typeHint];
        if (typeof childDecl === 'object')
          childTypeHint = childDecl[childName];
        self.renderPropertyRow(
          tbody,
          name + '.' + childName,
          childValue, childTypeHint, depth + 1);
      }
      return;
    }

    // Boolean.
    if (typeof value === 'boolean') {
      tdValue.innerHTML = '<span class="prop-value-boolean">'
        + String(value) + '</span>';
      return;
    }

    // Number.
    if (typeof value === 'number' || typeof value === 'bigint') {
      var numStr = String(value);
      // Trim float precision for display.
      if (typeof value === 'number' && numStr.indexOf('.') >= 0)
        numStr = parseFloat(value.toFixed(6)).toString();
      tdValue.innerHTML = '<span class="prop-value-number">'
        + numStr + '</span>';
      return;
    }

    // String.
    if (typeof value === 'string') {
      // Pointer reference: "P$TargetName".
      if (value.indexOf('P$') === 0) {
        var targetName = value.substring(2);
        var link = document.createElement('span');
        link.className = 'prop-value-pointer';
        link.textContent = value;
        link.title = 'Navigate to ' + targetName;
        link.addEventListener('click', function () {
          self.navigateToObject(targetName);
        });
        tdValue.appendChild(link);
        return;
      }

      // Raw bytes: "B$hexstring".
      if (value.indexOf('B$') === 0) {
        var hex = value.substring(2);
        var span2 = document.createElement('span');
        span2.className = 'prop-value-raw';
        if (hex.length > 32) {
          span2.textContent = hex.substring(0, 32)
            + '... (' + Math.floor(hex.length / 2) + ' bytes)';
          span2.title = hex;
        } else {
          span2.textContent = hex;
        }
        tdValue.appendChild(span2);
        return;
      }

      // Enum constant: "K$ConstantName".
      if (value.indexOf('K$') === 0) {
        tdValue.innerHTML = '<span class="prop-value-string">'
          + self.escapeHtml(value) + '</span>';
        return;
      }

      // Regular string.
      tdValue.innerHTML = '<span class="prop-value-string">"'
        + self.escapeHtml(value) + '"</span>';
      return;
    }

    // Fallback.
    tdValue.textContent = String(value);
  },

  /**
   * Format a value as a brief inline string (for array elements).
   */
  formatValueInline: function (value) {
    if (value === null || value === undefined)
      return 'null';
    if (typeof value === 'number')
      return String(typeof value === 'number'
        && String(value).indexOf('.') >= 0
        ? parseFloat(value.toFixed(4)).toString()
        : value);
    if (typeof value === 'bigint')
      return String(value) + 'n';
    if (typeof value === 'boolean')
      return String(value);
    if (typeof value === 'object')
      return '{...}';
    if (typeof value === 'string') {
      if (value.indexOf('P$') === 0)
        return value;
      if (value.indexOf('B$') === 0)
        return '[raw ' + Math.floor(value.length / 2) + 'B]';
      if (value.length > 20)
        return '"' + value.substring(0, 18) + '..."';
      return '"' + value + '"';
    }
    return String(value);
  },

  /**
   * Navigate to a target object by name (from pointer click).
   */
  navigateToObject: function (targetName) {
    // Try "O$targetName" key first.
    var fullKey = 'O$' + targetName;
    if (this.objects && this.objects[fullKey]) {
      this.selectObject(fullKey);
      return;
    }
    // Try exact match.
    if (this.objects && this.objects[targetName]) {
      this.selectObject(targetName);
      return;
    }
    this.updateStatus('Object "' + targetName + '" not found.', 'info');
  },

  // -- Status bar ---------------------------------------------------------

  updateStatus: function (message, level) {
    var el = this.dom.statusText;
    el.textContent = message;
    el.className = '';
    if (level === 'error')
      el.className = 'level-error';
    else if (level === 'success')
      el.className = 'level-success';
    else if (level === 'info')
      el.className = 'level-info';
  },

  // -- Utilities ----------------------------------------------------------

  escapeHtml: function (str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
