export class HashRouter {
  constructor(routes, onRoute) {
    this.routes = routes;
    this.onRoute = onRoute;
  }

  start() {
    window.addEventListener("hashchange", () => this.resolve());
    this.resolve();
  }

  resolve() {
    const rawHash = window.location.hash || "#/";
    const hashPath = rawHash.slice(1) || "/";
    const queryIndex = hashPath.indexOf("?");
    const route = queryIndex >= 0 ? hashPath.slice(0, queryIndex) : hashPath;
    const query = queryIndex >= 0 ? hashPath.slice(queryIndex + 1) : "";
    let params = null;
    const found = this.routes.find((item) => {
      if (item.path === route) {
        params = {};
        return true;
      }
      if (!item.pattern) return false;
      const match = route.match(item.pattern);
      if (match) {
        params = item.paramNames.reduce((value, name, index) => {
          value[name] = match[index + 1];
          return value;
        }, {});
        return true;
      }
      return false;
    });
    this.onRoute(found || { path: "*", route: null }, route, new URLSearchParams(query), params || {});
  }
}
