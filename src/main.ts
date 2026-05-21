import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";

import App from "./App.vue";
import router from "./router";
import i18n from "./i18n";
import "./styles/global.css";

const app = createApp(App);

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.config.errorHandler = (err, _instance, info) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[App error] ${info}:`, msg);
};

window.addEventListener(
  "error",
  (e) => {
    if (
      e.message === "ResizeObserver loop completed with undelivered notifications." ||
      e.message === "ResizeObserver loop limit exceeded"
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
  },
  true
);

window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "");
  if (msg.includes("ResizeObserver") || msg.includes("ECharts")) {
    e.preventDefault();
  }
});

app.use(ElementPlus, { size: "default" });
app.use(router);
app.use(i18n);
app.mount("#app");
