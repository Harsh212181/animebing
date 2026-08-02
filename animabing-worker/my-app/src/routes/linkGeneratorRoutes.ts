import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth, superAdminOnly } from '../middleware/auth'
import { shortenWithAllProviders } from '../services/externalShortenerService'

const linkGeneratorRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

linkGeneratorRoutes.post('/generate', adminAuth, superAdminOnly, async (c) => {
  try {
    const { url } = await c.req.json()
    if (!url || !url.startsWith('http')) {
      return c.json({ error: 'Valid URL required' }, 400)
    }
    const result = await shortenWithAllProviders(url, c.env)
    return c.json(result)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default linkGeneratorRoutes