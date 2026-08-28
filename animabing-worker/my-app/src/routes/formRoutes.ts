 // src/routes/formRoutes.ts
// Google-Forms-jaisa custom form builder: create form → public link se fill → admin responses dekhe

import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import {
  findMany, findOne, insertOne, updateOne,
  deleteOne, deleteMany, countDocuments,
  toObjectId, isValidObjectId, getDb
} from '../services/mongoService'
import { IForm, IFormField, IFormSubmission, IFormAnswer } from '../models/types'

const formRoutes = new Hono<{ Bindings: Env, Variables: Variables }>()

// ---------- helpers ----------
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function sanitizeFields(rawFields: any[]): IFormField[] {
  if (!Array.isArray(rawFields)) return []
  return rawFields.map((f: any, i: number) => {
    const type = ['text', 'textarea', 'email', 'number', 'date', 'radio', 'checkbox', 'dropdown']
      .includes(f.type) ? f.type : 'text'
    const needsOptions = type === 'radio' || type === 'checkbox' || type === 'dropdown'
    return {
      id: f.id || `f_${Date.now()}_${i}`,
      type,
      label: (f.label || `Question ${i + 1}`).toString().trim(),
      placeholder: f.placeholder ? String(f.placeholder) : undefined,
      required: !!f.required,
      options: needsOptions
        ? (Array.isArray(f.options) ? f.options.filter((o: any) => !!o).map((o: any) => String(o)) : [])
        : undefined,
      order: typeof f.order === 'number' ? f.order : i
    }
  }).sort((a, b) => a.order - b.order)
}

// ============================================================
// ============ ADMIN ROUTES (auth required) ============
// ============================================================

// list all forms
formRoutes.get('/admin/list', adminAuth, async (c) => {
  try {
    const forms = await findMany<IForm>('forms', {}, { sort: { createdAt: -1 } }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, forms })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// get one form (with fields) for editing
formRoutes.get('/admin/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const form = await findOne<IForm>('forms', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!form) return c.json({ error: 'Form not found' }, 404)
    return c.json({ success: true, form })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// create form
formRoutes.post('/admin/create', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { title, description, fields, slug: providedSlug, isActive } = await c.req.json()

    if (!title || !title.trim()) return c.json({ error: 'Title is required' }, 400)

    let slug = (providedSlug && providedSlug.trim()) ? slugify(providedSlug) : slugify(title)
    if (!slug) slug = `form-${Date.now()}`
    const slugExists = await findOne<IForm>('forms', { slug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (slugExists) slug = `${slug}-${Date.now()}`

    const form: IForm = {
      title: title.trim(),
      description: description ? String(description).trim() : '',
      slug,
      fields: sanitizeFields(fields),
      isActive: isActive !== false,
      submissionCount: 0,
      createdBy: admin.role === 'subadmin' ? admin.id : 'admin',
      createdByUsername: admin.username,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const inserted = await insertOne('forms', form, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Form created!', form: inserted })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// update form (title/description/fields/isActive/slug)
formRoutes.put('/admin/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const body = await c.req.json()

    const updateData: any = { updatedAt: new Date() }
    if (typeof body.title === 'string') updateData.title = body.title.trim()
    if (typeof body.description === 'string') updateData.description = body.description.trim()
    if (Array.isArray(body.fields)) updateData.fields = sanitizeFields(body.fields)
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive

    if (typeof body.slug === 'string' && body.slug.trim()) {
      const newSlug = slugify(body.slug)
      const existing = await findOne<IForm>('forms', { slug: newSlug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
      if (existing && existing._id?.toString() !== id) {
        return c.json({ error: 'Slug already in use by another form' }, 400)
      }
      updateData.slug = newSlug
    }

    const form = await updateOne('forms', { _id: toObjectId(id) }, updateData, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!form) return c.json({ error: 'Form not found' }, 404)
    return c.json({ success: true, message: 'Form updated!', form })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// toggle active
formRoutes.patch('/admin/:id/toggle-active', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const form = await findOne<IForm>('forms', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!form) return c.json({ error: 'Form not found' }, 404)
    const newActive = !form.isActive
    await updateOne('forms', { _id: toObjectId(id) }, { isActive: newActive, updatedAt: new Date() }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, isActive: newActive })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// delete form + its submissions
formRoutes.delete('/admin/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    await deleteOne('forms', { _id: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    await deleteMany('formsubmissions', { formId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Form and its responses deleted!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// list submissions for a form (Google Forms "Responses" tab jaisa)
formRoutes.get('/admin/:id/submissions', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)
    const db = await getDb(c.env.MONGODB_URI, c.env.MONGODB_DB)
    const submissions = await db.collection('formsubmissions')
      .find({ formId: toObjectId(id) })
      .sort({ submittedAt: -1 })
      .toArray()
    const total = await countDocuments('formsubmissions', { formId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, submissions, total })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// delete a single submission
formRoutes.delete('/admin/:id/submissions/:subId', adminAuth, async (c) => {
  try {
    const { id, subId } = c.req.param()
    if (!isValidObjectId(id) || !isValidObjectId(subId)) return c.json({ error: 'Invalid ID' }, 400)
    await deleteOne('formsubmissions', { _id: toObjectId(subId), formId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const currentCount = await countDocuments('formsubmissions', { formId: toObjectId(id) }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    await updateOne('forms', { _id: toObjectId(id) }, { submissionCount: currentCount }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    return c.json({ success: true, message: 'Response deleted' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============================================================
// ============ PUBLIC ROUTES (no auth — form fill karne ke liye) ============
// ============================================================

// get form structure by slug (to render the fill-form page)
formRoutes.get('/public/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')
    const form = await findOne<IForm>('forms', { slug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!form) return c.json({ error: 'Form not found' }, 404)
    if (form.isActive === false) return c.json({ error: 'This form is currently closed' }, 403)
    // password/internal fields expose mat karo, sirf jo public ko chahiye
    return c.json({
      success: true,
      form: {
        _id: form._id,
        title: form.title,
        description: form.description,
        fields: form.fields
      }
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// submit a response
formRoutes.post('/public/:slug/submit', async (c) => {
  try {
    const slug = c.req.param('slug')
    const form = await findOne<IForm>('forms', { slug }, c.env.MONGODB_URI, c.env.MONGODB_DB)
    if (!form) return c.json({ error: 'Form not found' }, 404)
    if (form.isActive === false) return c.json({ error: 'This form is currently closed' }, 403)

    const body = await c.req.json()
    const rawAnswers = body.answers || {}   // { [fieldId]: value }

    // required-field validation + label snapshot
    const answers: IFormAnswer[] = []
    for (const field of form.fields) {
      const val = rawAnswers[field.id]
      const isEmpty = val === undefined || val === null || val === '' ||
        (Array.isArray(val) && val.length === 0)
      if (field.required && isEmpty) {
        return c.json({ error: `"${field.label}" is required` }, 400)
      }
      if (!isEmpty) {
        answers.push({ fieldId: field.id, label: field.label, value: val })
      }
    }

    const submission: IFormSubmission = {
      formId: form._id!,
      answers,
      ip: c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('User-Agent') || '',
      submittedAt: new Date()
    }

    await insertOne('formsubmissions', submission, c.env.MONGODB_URI, c.env.MONGODB_DB)
    const newCount = (form.submissionCount || 0) + 1
    await updateOne('forms', { _id: form._id }, { submissionCount: newCount }, c.env.MONGODB_URI, c.env.MONGODB_DB)

    return c.json({ success: true, message: 'Response submitted!' })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default formRoutes