const ALLOWED_METHODS = new Set([
  "add",
  "put",
  "delete",
  "get",
  "update",
  "clear",
  "count",
  "bulkAdd",
  "bulkPut",
  "bulkDelete",
  "bulkGet",
  "bulkUpdate",
  "toArray",
  "toCollection",
  "modify",
  "each",
  "filter",
  "first",
  "last",
  "sortBy",
  "keys",
  "primaryKeys",
  "where",
  "equals",
  "above",
  "below",
  "between",
  "startsWith",
  "anyOf",
  "noneOf",
  "limit",
  "offset",
  "reverse",
  "distinct",
  "and",
  "or",
  "until",
  "table",
  "collection",
]);

function methodName(node) {
  if (!node || node.type !== "CallExpression") {
    return null;
  }
  const callee = node.callee;
  if (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier"
  ) {
    return callee.property.name;
  }
  return null;
}

function isAllowedAwait(argument) {
  const name = methodName(argument);
  return name !== null && ALLOWED_METHODS.has(name);
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow awaiting non-IndexedDB async work inside a Dexie transaction [D96]",
    },
    schema: [],
    messages: {
      forbidden:
        "Do not await non-IndexedDB async work inside a Dexie transaction [D96].",
    },
  },
  create(context) {
    function isDexieTransactionCall(node) {
      return (
        node.type === "CallExpression" &&
        node.callee.type === "MemberExpression" &&
        !node.callee.computed &&
        node.callee.property.type === "Identifier" &&
        node.callee.property.name === "transaction"
      );
    }

    function visit(node, onAwait) {
      if (!node || typeof node !== "object") {
        return;
      }
      if (node.type === "AwaitExpression") {
        onAwait(node);
      }
      for (const key of Object.keys(node)) {
        if (key === "parent") {
          continue;
        }
        const child = node[key];
        if (Array.isArray(child)) {
          for (const item of child) {
            visit(item, onAwait);
          }
        } else if (child && typeof child === "object" && child.type) {
          visit(child, onAwait);
        }
      }
    }

    return {
      CallExpression(node) {
        if (!isDexieTransactionCall(node)) {
          return;
        }
        const callback = node.arguments[node.arguments.length - 1];
        if (
          !callback ||
          (callback.type !== "FunctionExpression" &&
            callback.type !== "ArrowFunctionExpression")
        ) {
          return;
        }
        visit(callback.body, (awaitNode) => {
          if (!isAllowedAwait(awaitNode.argument)) {
            context.report({ node: awaitNode, messageId: "forbidden" });
          }
        });
      },
    };
  },
};

export default rule;
