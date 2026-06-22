/**
 * dependency-cruiser config — feeds the M4L2 structural map (context/map/artifact-2-structure.md).
 * Rules encode this repo's documented invariants (AGENTS.md) so they become machine-checkable.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "warn",
      comment: "Import cycles tangle module boundaries and widen the blast radius of a change.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-hook-imports-revalidate",
      severity: "error",
      comment:
        "Payload collection hooks run in a Route Handler context where updateTag() throws. " +
        "They must use revalidateTag, never import lib/cache/revalidate.ts (AGENTS.md).",
      from: { path: "^src/hooks/(transfers/|revalidate-collection)" },
      to: { path: "^src/lib/cache/revalidate\\.ts$" },
    },
    {
      name: "no-payload-graph-imports-env-server",
      severity: "error",
      comment:
        "env.server.ts is server-only and throws under `payload generate:types`. " +
        "payload.config.ts and collections must not pull it into the CLI graph (AGENTS.md).",
      from: { path: "^src/(payload\\.config\\.ts$|collections/)" },
      to: { path: "^src/lib/env\\.server\\.ts$" },
    },
    {
      name: "no-orphans",
      severity: "info",
      comment: "Orphan modules: possible dead code, stray entry points, or peripheral files.",
      from: {
        orphan: true,
        pathNot: [
          "\\.d\\.ts$",
          "(^|/)tsconfig\\.json$",
          "(^|/)(eslint|next|postcss|vitest|stryker|playwright)\\.config\\.[^/]+$",
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: {
      path: "node_modules|\\.test\\.|\\.spec\\.|__tests__|__mocks__|\\.d\\.ts$|src/migrations/",
    },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
    reporterOptions: {
      dot: { collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)" },
    },
  },
};
