import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json";
import multi from "@rollup/plugin-multi-entry";
import dts from "rollup-plugin-dts";

export default [
  {
    input: [
      "out/serverless/proto/common/v1/common.pb.ts",
      "out/serverless/proto/instrumentation/v1/log.pb.ts",
      "out/serverless/proto/instrumentation/v1/metric.pb.ts",
      "out/serverless/proto/instrumentation/v1/trace.pb.ts",
    ],
    // input: "src/index.ts",
    output: [
      {
        file: pkg.main,
        format: "cjs",
        sourcemap: true,
      },
      {
        file: pkg.module,
        format: "es",
        sourcemap: true,
      },
    ],
    plugins: [typescript(), multi()],
  },
  {
    input: [
      "dist/dts/common/v1/common.pb.d.ts",
      "dist/dts/instrumentation/v1/log.pb.d.ts",
      "dist/dts/instrumentation/v1/metric.pb.d.ts",
      "dist/dts/instrumentation/v1/trace.pb.d.ts",
    ],
    output: [
      {
        file: pkg.types,
        format: "es",
      },
    ],
    plugins: [multi(), dts()],
  },
];
