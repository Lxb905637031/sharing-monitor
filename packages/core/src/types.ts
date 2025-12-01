export interface Transport {
    send(data: Record<string, unknown>): void
}

export interface IIntegration {
    init(transport: Transport): void
}

export class Integration implements IIntegration {
    constructor(private callback: () => void) {}

    transport: Transport | null = null

    init(transport: Transport) {
        this.transport = transport
    }
}

export interface MonitorOptions {
    dsn: string
    integrations?: IIntegration[]
}
