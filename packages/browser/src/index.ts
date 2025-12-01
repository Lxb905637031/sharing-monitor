import { Metrics } from '@sharing/monitor-sdk-browser-utils'
import { Integration, Monitoring } from '@sharing/monitor-sdk-core'

import { Errors } from './tracing/errorsIntegration'
import { BrowserTransport } from './transport'

export function init(options: { dsn: string; integrations?: Integration[] }) {
    const monitoring = new Monitoring({
        dsn: options.dsn,
        integrations: options.integrations,
    })

    const transport = new BrowserTransport(options.dsn)

    monitoring.init(transport)

    new Errors(transport).init()
    new Metrics(transport).init()

    return monitoring
}
