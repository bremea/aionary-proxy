import * as http from "http";
import httpProxy from "http-proxy";
import { WebSocket } from "ws";
const server = http.createServer();
const proxy = httpProxy.createProxyServer({ ws: true });
server.on("upgrade", function (req, socket) {
    console.log(req.url);
    proxy.ws(req, socket, {
        target: "ws://06e82e09c27487.vm.aionary-gamews.internal",
    });
});
const ws = new WebSocket("ws://06e82e09c27487.vm.aionary-gamews.internal");
ws.onopen = () => {
    console.log("connected");
};
console.log("Running Proxy");
server.listen(8080);
//# sourceMappingURL=index.js.map