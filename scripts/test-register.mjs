import { registerHooks } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";

function tryResolveTs(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const isTs = candidate.endsWith(".ts") || candidate.endsWith(".tsx");
      return {
        url: pathToFileURL(candidate).href,
        format: isTs ? "module-typescript" : undefined,
        shortCircuit: true,
      };
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = path.resolve(process.cwd(), "src", specifier.slice(2));
      const hit = tryResolveTs(base);
      if (hit) return hit;
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:") &&
      !context.parentURL.includes("/node_modules/")
    ) {
      const dir = path.dirname(fileURLToPath(context.parentURL));
      const hit = tryResolveTs(path.resolve(dir, specifier));
      if (hit) return hit;
    }
    const resolved = nextResolve(specifier, context);
    if (
      (resolved.url.endsWith(".ts") || resolved.url.endsWith(".tsx")) &&
      !resolved.url.includes("/node_modules/")
    ) {
      return { ...resolved, format: "module-typescript" };
    }
    return resolved;
  },
});
