import { BinaryExpression, Expression, ExpressionStatement, StringLiteral } from "@swc/core";
import * as swc from "@swc/core";

import { Visitor } from "@swc/core/Visitor";

export class PlaceholderReplacer extends Visitor {
  private readonly placeholder: string;
  private readonly expression: Expression;

  constructor(placeholder: string, expression: string) {
    super();
    this.placeholder = placeholder;
    this.expression = PlaceholderReplacer.parseExpression(expression);
  }

  static parseExpression(expression: string) {
    return (swc.parseSync(expression).body[0] as ExpressionStatement).expression;
  }

  // @ts-ignore We changed expression type
  visitStringLiteral(node: StringLiteral): Expression {
    const stringParts = node.value.split(this.placeholder);
    if (stringParts.length === 1) return node;

    const createStringExpression = (str: string): StringLiteral => ({
      type: "StringLiteral",
      span: { start: 0, end: 0, ctxt: 0 },
      value: str,
      hasEscape: true
    });

    let subExpressions: Expression[] = Array(stringParts.length * 2 - 1);
    for (let i = 0; i < stringParts.length; i++) {
      subExpressions[i * 2] = createStringExpression(stringParts[i]);
      if (i !== stringParts.length - 1) {
        subExpressions[i * 2 + 1] = this.expression;
      }
    }

    subExpressions = subExpressions.filter(expr => expr.type !== "StringLiteral" || expr.value !== "");

    if (subExpressions.length === 1) return subExpressions[0];

    const createAddExpression = (left: Expression): BinaryExpression => ({
      type: "BinaryExpression",
      span: { start: 0, end: 0, ctxt: 0 },
      operator: "+",
      left: left,
      right: null
    });

    let rootExpression: Expression;
    let previousExpression: BinaryExpression;
    for (let i = 0; i < subExpressions.length; i++) {
      const currentSubExpression = subExpressions[i];
      if (i === 0) {
        previousExpression = rootExpression = createAddExpression(currentSubExpression);
      } else if (i === subExpressions.length - 1) {
        previousExpression.right = currentSubExpression;
      } else {
        previousExpression.right = createAddExpression(currentSubExpression);
        previousExpression = previousExpression.right;
      }
    }

    return rootExpression;
  }
}

export async function replaceStringWithExpression(
  code: string,
  placeholder: string,
  expression: string,
  minify: boolean
) {
  const ast = await swc.parse(code);
  const replacer = new PlaceholderReplacer(placeholder, expression);
  replacer.visitModule(ast);
  return (await swc.print(ast, { minify })).code;
}
