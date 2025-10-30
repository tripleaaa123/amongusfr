import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("accessory", "routes/accessory.tsx"),
  route("host/create", "routes/host.create.tsx"),
  route("game/:gameId/lobby", "routes/game.$gameId.lobby.tsx"),
  route("game/:gameId/play", "routes/game.$gameId.play.tsx"),
  route("game/:gameId/end", "routes/game.$gameId.end.tsx"),
  route("game/:gameId/accessory", "routes/game.$gameId.accessory.tsx"),
] satisfies RouteConfig;
