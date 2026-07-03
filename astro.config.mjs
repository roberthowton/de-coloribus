import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://coloribus.roberthowton.com",
  output: "server",
  adapter: vercel(),
});
