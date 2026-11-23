import net from 'node:net';import tls from 'node:tls';import http from 'node:http';import https from 'node:https';import {syncBuiltinESMExports} from 'node:module';
const denied=()=>{throw Error('network_forbidden_in_local_certification');};
globalThis.fetch=denied;net.connect=denied;net.createConnection=denied;net.Socket.prototype.connect=denied;tls.connect=denied;http.request=denied;http.get=denied;https.request=denied;https.get=denied;syncBuiltinESMExports();

