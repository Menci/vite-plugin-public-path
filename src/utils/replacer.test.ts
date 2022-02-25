import { replaceStringWithExpression } from "./replacer";

test("JS code substitution with SWC AST traversal", async () => {
  const getCodeWithHardCodedString = (str: string) =>
    `(dynamicStr) => ${JSON.stringify(`"'\\'\\"\u1234` + str + `"'!!!\n\n\t\t'"` + str)}`;
  const expression = "dynamicStr";

  const placeholder = "__placeholder__";
  const originalCode = getCodeWithHardCodedString(placeholder);
  const replacedCode = await replaceStringWithExpression(originalCode, placeholder, expression, true);

  const newString = "__new_string__";
  const hardCodeNewString = eval(getCodeWithHardCodedString(newString))();
  const dynamicPassNewString = eval(replacedCode)(newString);

  expect(dynamicPassNewString).toEqual(hardCodeNewString);
});
