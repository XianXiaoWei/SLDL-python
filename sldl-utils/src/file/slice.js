class FileSlice {
  /**
   * Create a copy of `a` or copy `a` to `b`.
   * @param {FileSlice} a 
   * @param {FileSlice} b 
   * @returns {FileSlice}
   */
  static copy(a, b) {
    var result = b || new FileSlice();
    result.file = a.file;
    result.content = a.content;
    result.parentLine = a.parentLine;
    result.size = a.size;
    result.next = a.next;
    return result
  }

  /**
   * @param {string} file - File Path.
   * @param {string} content - Original file content.
   * @param {number} [start] - Slice start position in the file, in lines.
   * @param {number} [line] - Slice size, in lines.
   * @param {FileSlice} [next] - Next slice.
   * @returns {FileSlice}
   */
  static fromFile(file, content, start, line, next) {
    var result = new FileSlice();
    start = start || 0;
    result.completeFile = content;
    result.file = file;
    // We assume that the comments in the file is replaced with empty lines.
    if (typeof line == "undefined")
      result.content = content.split("\n");
    else
      result.content = content.split("\n").slice(start, start + line);
    result.size = typeof line == "undefined" ? result.content.length : line;
    result.parentLine = start;
    result.next = next || null;
    return result
  }

  constructor() {
    /** File path. */
    this.file = "";
    /** Content of this slice. */
    this.content = [];
    /** Start position. */
    this.parentLine = 0;
    /** Amount of lines this slice contains. */
    this.size = 0;
    /** Next slice. */
    this.next = null;
  }

  /**
   * @returns {string}
   */
  getContent() {
    return this.content.join("\n")
  }

  /**
   * Get the specified line in the current slice.
   * @param {number} line 
   */
  getLine(line) {
    return this.content.at(line);
  }

  /**
   * Insert a `FileSlice` object before the specified line.
   * @param {number} start - Start line.
   * @param {FileSlice} inserted - The `FileSlice` object to be inserted.
   * @returns {FileSlice}
   */
  insert(start, inserted) {
    var oldLines = this.content.slice(0, start)
      , newLines = this.content.slice(start)
      , result, s;

    if (!newLines.length) {
      // `start` is larger than the file size. Set `this.next` only.
      inserted.next = this.next;
      this.next = inserted;
      return
    } else if (!oldLines.length) {
      // Current slice is completely replaced by a copy of `inserted`.
      result = FileSlice.copy(this);
      FileSlice.copy(inserted, this);
      s = this
    } else {
      result = FileSlice.copy(this);
      result.content = newLines;
      result.parentLine = this.parentLine + start;
      result.size = newLines.length;
      this.next = inserted;
      this.content = oldLines;
      this.size = oldLines.length;
      s = inserted
    }
    for (; ; s = s.next)
      if (!s.next) {
        s.next = result;
        break
      }
    return this
  }

  /**
   * Replace lines with empty line.
   * @param {number} line - Line number in current slice.
   * @param {number} [count] 
   * @returns {FileSlice}
   */
  clear(line, count) {
    count = count || 1;
    for (var i = line; i < line + count; i++)
      if (typeof this.content[i] == "string")
        this.content[i] = "";
    return this
  }

  /**
   * Cut a section of a FileSlice.
   * @param {number} start 
   * @param {number} line 
   * @returns {FileSlice}
   */
  slice(start, line) {
    var result = FileSlice.copy(this);
    result.content = this.content.slice(start, line);
    result.next = null;
    result.size = result.content.length;
    return result
  }

  /**
   * Duplicate a section of the FileSlice chain.
   * @param {number} start 
   * @param {number} line 
   * @param {number} count 
   */
  duplicate(start, line, count) {

  }

  /**
   * Replace part of a line with given string.
   * @param {number} line - Line number of current slice.
   * @param {number} begin - Column numebr of specified line.
   * @param {number} length - Length of area to be replaced.
   * @param {string} string - String without `\n`.
   * @returns {boolean}
   */
  replaceWord(line, begin, length, string) {
    var r = this.content[line].slice(0, begin)
      , s = this.content[line].slice(begin + length);

    string.replace(/\n/g, "");

    this.content[line] = r + string + s;
  }

  /**
   * Flatten the FileSlice chain into a single FileSlice with all content
   * concatenated and correct line numbering.
   * @returns {FileSlice}
   */
  flatten() {
    var result = new FileSlice()
      , content = []
      , slice = this;
    result.file = this.file;
    result.parentLine = 0;
    while (slice) {
      content = content.concat(slice.content);
      slice = slice.next;
    }
    result.content = content;
    result.size = content.length;
    result.next = null;
    return result
  }

  toString() {
    return `# "${this.file}": ${this.parentLine}\n${this.getContent()}${this.next ? "\n" + this.next : ""}`
  }
}

module.exports = {
  FileSlice
};