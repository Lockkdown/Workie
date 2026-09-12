const FORBIDDEN = new Set(["alert", "confirm", "prompt"]);
const GLOBALS = new Set(["window", "globalThis", "self", "global"]);

function calleeTarget(node) {
  if (node.type === "Identifier") {
    return { kind: "id", name: node.name };
  }
  if (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.property.type === "Identifier"
  ) {
    const object = node.object.type === "Identifier" ? node.object.name : null;
    return { kind: "member", object, name: node.property.name };
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow alert, confirm, and prompt so no browser-supplied string reaches the user [D104]",
    },
    schema: [],
    messages: {
      forbidden:
        "Do not call alert, confirm, or prompt. Use a Workie dialog or inline system state [D104].",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const target = calleeTarget(node.callee);
        if (!target || !FORBIDDEN.has(target.name)) {
          return;
        }
        if (target.kind === "id") {
          context.report({ node, messageId: "forbidden" });
          return;
        }
        if (target.object && GLOBALS.has(target.object)) {
          context.report({ node, messageId: "forbidden" });
        }
      },
    };
  },
};

export default rule;
