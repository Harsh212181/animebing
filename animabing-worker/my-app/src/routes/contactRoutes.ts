import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { insertOne } from '../services/mongoService'

const contactRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

contactRoutes.post('/contact', async (c) => {
  try {
    const { name, email, subject, message } = await c.req.json()

    if (!name || !email || !subject || !message) {
      return c.json({ success: false, error: 'All fields are required' }, 400)
    }

    const report = {
      name, email, subject, message,
      type: 'contact',
      username: name,
      userIP: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || 'Unknown'
    }

    await insertOne('reports', report, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Thank you! We will get back to you soon.' })
  } catch (err: any) {
    return c.json({ success: false, error: 'Failed to send message.' }, 500)
  }
})

export default contactRoutes