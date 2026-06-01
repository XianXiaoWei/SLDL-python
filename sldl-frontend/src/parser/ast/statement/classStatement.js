const { Typedef } = require("../../env.js");
const { AstNode } = require("../astNode.js");
const { Statement } = require("./statement.js");

/** Represents a member variable of a class. */
class ClassMemberDecl extends AstNode {
  /**
   * @param {Typedef} type 
   * @param {Token} id 
   * @param {Constant|undefined} defaultVal 
   */
  constructor(type, id, defaultVal) {
    super(id);

    this.type = type;
    this.id = id;
    this.defaultVal = defaultVal;
  }

  /**
   * Get the name in a string.
   * @returns {string}
   */
  getName() {
    return this.id.raw();
  }
}

/** Represents a class. */
class ClassStatement extends Statement {
  /**
   * @param {Token} token - The token "class".
   * @param {Token} name - The class name.
   * @param {Typedef} parent 
   */
  constructor(token, name, parent, decl) {
    super(token);

    this.name = name;
    this.parent = parent;

    this.members = new Map();

    if (parent) {
      if (!(parent.node instanceof ClassStatement))
        throw new Error(parent.token.raw() + " is not a extendable class");

      for (var kv of parent.node.members)
        this.members.set(kv[0], kv[1]);
    }
  }

  /**
   * @param {ClassMemberDecl} member
   */
  addMember(member) {
    var name = member.getName();
    if (this.members.has(name))
      throw new Error("duplicated member: " + name);

    this.members.set(name, member);
  }
}

module.exports = {
  ClassMemberDecl,
  ClassStatement
};
