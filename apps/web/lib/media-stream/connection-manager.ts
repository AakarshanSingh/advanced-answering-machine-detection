interface StreamConnection {
  ws: WebSocket;
  callSid: string;
  streamSid: string;
  role: "caller" | "agent";
  pairedCallSid?: string;
}

class ConnectionManager {
  private connections: Map<string, StreamConnection>;
  private callPairs: Map<string, string>;

  constructor() {
    this.connections = new Map();
    this.callPairs = new Map();
  }

  addConnection(callSid: string, connection: StreamConnection): void {
    this.connections.set(callSid, connection);
  }

  getConnection(callSid: string): StreamConnection | undefined {
    return this.connections.get(callSid);
  }

  removeConnection(callSid: string): void {
    const connection = this.connections.get(callSid);

    if (connection?.pairedCallSid) {
      this.callPairs.delete(connection.callSid);
      this.callPairs.delete(connection.pairedCallSid);
    }

    this.connections.delete(callSid);
  }

  pairConnections(callerSid: string, agentSid: string): void {
    this.callPairs.set(callerSid, agentSid);
    this.callPairs.set(agentSid, callerSid);

    const callerConn = this.connections.get(callerSid);
    const agentConn = this.connections.get(agentSid);

    if (callerConn) {
      callerConn.pairedCallSid = agentSid;
    }

    if (agentConn) {
      agentConn.pairedCallSid = callerSid;
    }
  }

  getPairedConnection(callSid: string): StreamConnection | undefined {
    const pairedSid = this.callPairs.get(callSid);
    return pairedSid ? this.connections.get(pairedSid) : undefined;
  }

  hasPair(callSid: string): boolean {
    return this.callPairs.has(callSid);
  }

  getAllConnections(): StreamConnection[] {
    return Array.from(this.connections.values());
  }

  getActiveCallCount(): number {
    return this.connections.size;
  }

  cleanup(): void {
    this.connections.forEach((conn) => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.close();
      }
    });

    this.connections.clear();
    this.callPairs.clear();
  }
}

export const connectionManager = new ConnectionManager();
export type { StreamConnection };
