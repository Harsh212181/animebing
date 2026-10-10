// src/routes/formRoutes.ts
// Google-Forms-jaisa custom form builder

import { Hono } from 'hono'
import { Env, Variables } from '../index'
import { adminAuth } from '../middleware/auth'
import {
  toObjectId, isValidObjectId, withDb
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
// ✅ FIX: findMany helper → single withDb
formRoutes.get('/admin/list', adminAuth, async (c) => {
  try {
    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'forms/admin/list', async (db) => {
      const forms = await db.collection('forms')
        .find({})
        .sort({ createdAt: -1 })
        .toArray()
      return c.json({ success: true, forms })
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// get one form
// ✅ FIX: findOne helper → single withDb
formRoutes.get('/admin/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'forms/admin/get', async (db) => {
      const form = await db.collection('forms').findOne({ _id: toObjectId(id) })
      if (!form) return c.json({ error: 'Form not found' }, 404)
      return c.json({ success: true, form })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// create form
// ✅ FIX: findOne + insertOne helpers (2 connections) → 1 withDb
formRoutes.post('/admin/create', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const { title, description, fields, slug: providedSlug, isActive } = await c.req.json()

    if (!title || !title.trim()) return c.json({ error: 'Title is required' }, 400)

    let slug = (providedSlug && providedSlug.trim()) ? slugify(providedSlug) : slugify(title)
    if (!slug) slug = `form-${Date.now()}`

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'forms/admin/create', async (db) => {
      const slugExists = await db.collection('forms').findOne({ slug })
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

      // Match `insertOne` helper behavior: spread + force createdAt/updatedAt
      const result = await db.collection('forms').insertOne({
        ...form,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      return c.json({ success: true, message: 'Form created!', form: result })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// update form (title/description/fields/isActive/slug)
// ✅ FIX: findOne + updateOne helpers → 1 withDb
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

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'forms/admin/update', async (db) => {
      if (typeof body.slug === 'string' && body.slug.trim()) {
        const newSlug = slugify(body.slug)
        const existing = await db.collection('forms').findOne({ slug: newSlug })
        if (existing && existing._id?.toString() !== id) {
          return c.json({ error: 'Slug already in use by another form' }, 400)
        }
        updateData.slug = newSlug
      }

      // Match `updateOne` helper behavior: $set + force updatedAt
      const form = await db.collection('forms').findOneAndUpdate(
        { _id: toObjectId(id) },
        { $set: { ...updateData, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      if (!form) return c.json({ error: 'Form not found' }, 404)
      return c.json({ success: true, message: 'Form updated!', form })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// toggle active
// ✅ FIX: findOne + updateOne helpers → 1 withDb
formRoutes.patch('/admin/:id/toggle-active', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'forms/admin/toggle-active', async (db) => {
      const form = await db.collection('forms').findOne({ _id: toObjectId(id) })
      if (!form) return c.json({ error: 'Form not found' }, 404)

      const newActive = !form.isActive
      await db.collection('forms').findOneAndUpdate(
        { _id: toObjectId(id) },
        { $set: { isActive: newActive, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      return c.json({ success: true, isActive: newActive })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// delete form + its submissions
// ✅ FIX: deleteOne + deleteMany helpers → 1 withDb
formRoutes.delete('/admin/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'forms/admin/delete', async (db) => {
      await db.collection('forms').deleteOne({ _id: toObjectId(id) })
      await db.collection('formsubmissions').deleteMany({ formId: toObjectId(id) })
      return c.json({ success: true, message: 'Form and its responses deleted!' })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// list submissions for a form
// ✅ FIX: getDb + countDocuments helper (2 connections) → 1 withDb
formRoutes.get('/admin/:id/submissions', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    if (!isValidObjectId(id)) return c.json({ error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'forms/admin/submissions', async (db) => {
      const submissions = await db.collection('formsubmissions')
        .find({ formId: toObjectId(id) })
        .sort({ submittedAt: -1 })
        .toArray()
      const total = await db.collection('formsubmissions')
        .countDocuments({ formId: toObjectId(id) })
      return c.json({ success: true, submissions, total })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// delete a single submission
// ✅ FIX: deleteOne + countDocuments + updateOne helpers → 1 withDb
formRoutes.delete('/admin/:id/submissions/:subId', adminAuth, async (c) => {
  try {
    const { id, subId } = c.req.param()
    if (!isValidObjectId(id) || !isValidObjectId(subId)) return c.json({ error: 'Invalid ID' }, 400)

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'forms/admin/submission-delete', async (db) => {
      await db.collection('formsubmissions').deleteOne({
        _id: toObjectId(subId),
        formId: toObjectId(id)
      })
      const currentCount = await db.collection('formsubmissions')
        .countDocuments({ formId: toObjectId(id) })
      await db.collection('forms').findOneAndUpdate(
        { _id: toObjectId(id) },
        { $set: { submissionCount: currentCount, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      return c.json({ success: true, message: 'Response deleted' })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ============================================================
// ============ PUBLIC ROUTES (no auth) ============
// ============================================================

// get form structure by slug
// ✅ FIX: findOne helper → single withDb
formRoutes.get('/public/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'forms/public/get', async (db) => {
      const form = await db.collection('forms').findOne({ slug }) as IForm | null
      if (!form) return c.json({ error: 'Form not found' }, 404)
      if (form.isActive === false) return c.json({ error: 'This form is currently closed' }, 403)

      return c.json({
        success: true,
        form: {
          _id: form._id,
          title: form.title,
          description: form.description,
          fields: form.fields
        }
      })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// submit a response
// ✅ FIX: findOne + insertOne + updateOne helpers (3 connections) → 1 withDb
formRoutes.post('/public/:slug/submit', async (c) => {
  try {
    const slug = c.req.param('slug')
    const body = await c.req.json()
    const rawAnswers = body.answers || {}

    return await withDb(c.env.MONGODB_URI, c.env.MONGODB_DB, 'forms/public/submit', async (db) => {
      const form = await db.collection('forms').findOne({ slug }) as IForm | null
      if (!form) return c.json({ error: 'Form not found' }, 404)
      if (form.isActive === false) return c.json({ error: 'This form is currently closed' }, 403)

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

      // Match `insertOne` helper behavior
      await db.collection('formsubmissions').insertOne({
        ...submission,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const newCount = (form.submissionCount || 0) + 1
      await db.collection('forms').findOneAndUpdate(
        { _id: form._id },
        { $set: { submissionCount: newCount, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )

      return c.json({ success: true, message: 'Response submitted!' })
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default formRoutes