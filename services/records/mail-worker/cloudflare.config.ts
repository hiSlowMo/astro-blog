import process from 'node:process'

export default {
  worker: {
    name: 'slowmo-records-notify',
    entrypoint: './worker.js',
    compatibilityDate: '2026-11-18',
    env: {
      EMAIL: { type: 'send-email', destinationAddress: process.env.RECORDS_RECIPIENT },
    },
    observability: { enabled: true, traces: { enabled: true } },
    workersDev: false,
    triggers: [{ type: 'fetch', pattern: 'www.theslowmo.com/_records/notify', zone: 'theslowmo.com' }],
  },
}
