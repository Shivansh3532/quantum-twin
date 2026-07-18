import ts from "typescript";
import { readFile } from "node:fs/promises";

export type ScannerHit = { file: string; operation: "signing" | "verification"; line: number; snippet: string };

export async function scanCrypto(file: string): Promise<ScannerHit[]> {
  const source = await readFile(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hits: ScannerHit[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(ast).split(".").at(-1);
      if (name === "sign" || name === "verify") {
        const algorithm = node.arguments[0]?.getText(ast) ?? "";
        if (/sha(256|384|512)|RSA/i.test(algorithm)) {
          const { line } = ast.getLineAndCharacterOfPosition(node.getStart(ast));
          hits.push({ file, operation: name === "sign" ? "signing" : "verification", line: line + 1, snippet: node.getText(ast) });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return hits;
}
