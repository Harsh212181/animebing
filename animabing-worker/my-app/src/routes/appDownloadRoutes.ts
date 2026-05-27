import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { findMany } from '../services/mongoService'
import { IAppDownload } from '../models/types'

const appDownloadRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

appDownloadRoutes.get('/', async (c) => {
  try {
    const links = await findMany<IAppDownload>('appdownloads', { isActive: true }, {}, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json(links)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default appDownloadRoutes