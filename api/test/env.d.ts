import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import type { Env as AppEnv } from "../src/types";

declare global {
  namespace Cloudflare {
    interface GlobalProps {
      mainModule: typeof import("../src/index");
      durableNamespaces: "Channel";
    }
    interface Env extends AppEnv {
      ID_MIGRATIONS: D1Migration[];
      ROOMS_MIGRATIONS: D1Migration[];
    }
  }
}
