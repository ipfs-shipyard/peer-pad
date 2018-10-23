'use strict'

const ms = require('milliseconds')
const replicaBehavior = require('./replica-behavior')

module.exports = ({events, text}) => async ({ page, data: url, worker }) => {
  try {
    page.setDefaultNavigationTimeout(120000)
    await page.goto(url)
    page.on('console', (m) => events.emit('message', `[worker ${worker.id}]: ${m.text()}`))
    await page.waitForSelector('[data-id=ipfs-status][data-value=online]', {timeout: ms.minutes(2)})
    await replicaBehavior({page, worker, text})
  } catch (err) {
    console.error(`error in worker ${worker.id}:`, err)
    throw err
  }
}