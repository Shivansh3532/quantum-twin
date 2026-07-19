import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type { ScannerHit } from "./domain.ts";
import type { QuantumTwinConfig } from "./config.ts";
import { contained } from "./repository.ts";

const DEFAULT_EXCLUDES = [".git", "node_modules", ".next", "dist", "build", "coverage", "runs"];
const SOURCE = /\.(?:[cm]?[jt]sx?|py|java|cs|go|rs)$/i;

function glob(pattern: string) {
  const marker = "\u0000";
  const escaped = pattern.replaceAll("\\", "/").replaceAll("**", marker).replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*").replaceAll(marker, ".*");
  return new RegExp(`^${escaped}$`);
}

async function sourceFiles(root: string, config?: QuantumTwinConfig) {
  const started = performance.now();
  const limits = config?.limits ?? { maxFiles: 5_000, maxFileBytes: 2_000_000, maxTotalBytes: 50_000_000 };
  const scanMs = config?.timeouts.scanMs ?? 30_000;
  const include = (config?.includedSourceGlobs ?? ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.cjs", "**/*.mjs", "**/*.py", "**/*.java", "**/*.cs", "**/*.go", "**/*.rs", "*.ts", "*.js", "*.py", "*.java", "*.cs", "*.go", "*.rs"]).map(glob);
  const exclude = (config?.excludedGlobs ?? []).map(glob);
  const files: string[] = [];
  let bytes = 0, count = 0;
  async function walk(directory: string) {
    if (performance.now() - started > scanMs) throw new Error(`Scan exceeded ${scanMs}ms`);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (DEFAULT_EXCLUDES.includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).replaceAll("\\", "/");
      if (exclude.some(rule => rule.test(relative))) continue;
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) throw new Error(`Symlinks are not accepted: ${relative}`);
      if (!contained(root, absolute)) throw new Error(`Path escapes repository: ${relative}`);
      if (info.isDirectory()) await walk(absolute);
      else if (SOURCE.test(entry.name) && include.some(rule => rule.test(relative))) {
        if (++count > limits.maxFiles) throw new Error(`Scan exceeds ${limits.maxFiles} files`);
        if (info.size > limits.maxFileBytes) throw new Error(`File exceeds size limit: ${relative}`);
        bytes += info.size;
        if (bytes > limits.maxTotalBytes) throw new Error(`Scan exceeds ${limits.maxTotalBytes} bytes`);
        files.push(absolute);
      }
    }
  }
  await walk(root);
  return files;
}

function scanSource(root: string, file: string, source: string): ScannerHit[] {
  const scriptKind = /x$/i.test(path.extname(file)) ? ts.ScriptKind.TSX : /\.js/i.test(path.extname(file)) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const named = new Map<string, string>(), namespaces = new Set<string>();
  let importForm: ScannerHit["importForm"] = "syntax";
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && ["node:crypto", "crypto"].includes((statement.moduleSpecifier as ts.StringLiteral).text)) {
      if (statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
        importForm = "named";
        for (const item of statement.importClause.namedBindings.elements) named.set(item.name.text, item.propertyName?.text ?? item.name.text);
      } else if (statement.importClause?.namedBindings && ts.isNamespaceImport(statement.importClause.namedBindings)) {
        importForm = "namespace";
        namespaces.add(statement.importClause.namedBindings.name.text);
      }
    }
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (!declaration.initializer || !ts.isCallExpression(declaration.initializer) || declaration.initializer.expression.getText(ast) !== "require") continue;
      const module = declaration.initializer.arguments[0];
      if (!module || !ts.isStringLiteral(module) || !["node:crypto", "crypto"].includes(module.text)) continue;
      importForm = "commonjs";
      if (ts.isIdentifier(declaration.name)) namespaces.add(declaration.name.text);
      else if (ts.isObjectBindingPattern(declaration.name)) for (const item of declaration.name.elements) named.set(item.name.getText(ast), item.propertyName?.getText(ast) ?? item.name.getText(ast));
    }
  }
  const hits: ScannerHit[] = [];
  const add = (node: ts.Node, operation: ScannerHit["operation"], technology: string, status: ScannerHit["status"], algorithmEvidence: string, reason?: string, requiredAdapter?: string) => {
    const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
    hits.push({ file: relative, line, operation, technology, importForm, algorithmEvidence, confidence: status === "supported" ? .98 : status === "discovery-only" ? .9 : .55, status, snippet: node.getText(ast).slice(0, 240), reason, requiredAdapter });
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      let cryptoName: string | undefined;
      if (ts.isIdentifier(expression)) cryptoName = named.get(expression.text);
      else if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) && namespaces.has(expression.expression.text)) cryptoName = expression.name.text;
      if (cryptoName && ["sign", "verify", "createSign", "createVerify"].includes(cryptoName)) {
        const algorithm = node.arguments[0]?.getText(ast) ?? "dynamic";
        const operation = /verify/i.test(cryptoName) ? "verification" : "signing";
        if (/sha(?:256|384|512)|rsa/i.test(algorithm)) add(node, operation, "native node:crypto RSA", "supported", algorithm);
        else if (algorithm !== "null") add(node, operation, "node:crypto ambiguous algorithm", "unknown", algorithm, "Algorithm cannot be proven as supported RSA", "Explicit algorithm and repository contract");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const discovery = [
    [/\b(?:tls|x509|X509Certificate)\b/, "TLS/X.509", "transport", "TLS/certificate adapter and certificate lifecycle input"],
    [/\b(?:jsonwebtoken|jose|jwt)\b/i, "JWT library", "token", "JWT adapter and token compatibility contract"],
    [/\b(?:KMSClient|@aws-sdk\/client-kms|cloudkms)\b/, "Cloud KMS", "key-management", "Cloud KMS adapter and authorized test environment"],
    [/\b(?:pkcs11|pkcs#11|hsm)\b/i, "HSM/PKCS#11", "key-management", "Hardware-backed adapter and operator input"],
    [/\b(?:node-forge|crypto-js|tweetnacl|sodium)\b/i, "Third-party cryptography", "unknown", "Library-specific adapter"],
    [/\b(?:java\.security|Signature\.getInstance)\b/, "Java cryptography", "unknown", "Java repository adapter"],
    [/\b(?:from cryptography|import cryptography|Crypto\.Signature)\b/, "Python cryptography", "unknown", "Python repository adapter"],
    [/\b(?:System\.Security\.Cryptography|RSA\.Create)\b/, ".NET cryptography", "unknown", ".NET repository adapter"],
    [/\b(?:crypto\/rsa|rsa\.Sign)\b/, "Go cryptography", "unknown", "Go repository adapter"],
    [/\b(?:rsa::|ring::signature)\b/, "Rust cryptography", "unknown", "Rust repository adapter"]
  ] as const;
  for (const [pattern, technology, operation, adapter] of discovery) if (pattern.test(source)) add(ast, operation, technology, "discovery-only", pattern.source, "Automatic migration unsupported", adapter);
  return hits;
}

export async function scanRepository(root: string, config?: QuantumTwinConfig) {
  const hits: ScannerHit[] = [];
  for (const file of await sourceFiles(root, config)) hits.push(...scanSource(root, file, await readFile(file, "utf8")));
  return hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

export async function scanCrypto(file: string) {
  const root = path.dirname(path.dirname(file));
  return scanSource(root, file, await readFile(file, "utf8"));
}
