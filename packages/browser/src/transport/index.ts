import { getBrowserInfo } from '@sharing/monitor-sdk-browser-utils'
import { Transport } from '@sharing/monitor-sdk-core'

export class BrowserTransport implements Transport {
    constructor(private dsn: string) {}

    send(data: Record<string, unknown>) {
        const browserInfo = getBrowserInfo()

        const payload = {
            ...data,
            ...browserInfo,
        }

        fetch(this.dsn, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
    }
}
