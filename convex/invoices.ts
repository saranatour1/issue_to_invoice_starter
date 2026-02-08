import { ConvexError } from 'convex/values';
import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';

import {
  finalizeInvoiceFromDraftArgsSchema,
  getInvoiceArgsSchema,
  listInvoicesForViewerArgsSchema,
  listTimeEntriesForInvoiceArgsSchema,
  updateInvoiceArgsSchema,
} from './issueModel';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

const zQuery = zCustomQuery(query, NoOp);
const zMutation = zCustomMutation(mutation, NoOp);

async function requireViewerId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError('Not authenticated');
  }
  return identity.subject;
}

function randomInvoiceSuffix() {
  return Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
}

function formatDateYYYYMMDDUtc(ms: number) {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

async function requireProjectForViewer(
  ctx: { db: { get: (tableName: string, id: any) => Promise<any> } },
  args: { projectId: Id<'projects'>; viewerId: string },
) {
  const project = await ctx.db.get('projects', args.projectId);
  if (!project) {
    throw new ConvexError('Project not found');
  }
  if (project.creatorId !== args.viewerId && !project.memberIds.includes(args.viewerId)) {
    throw new ConvexError('Not authorized for this project');
  }
  return project as Doc<'projects'>;
}

async function enrichTimeEntries(
  ctx: { db: { get: (tableName: string, id: any) => Promise<any> } },
  entries: Array<Doc<'timeEntries'>>,
) {
  const issueIds = new Set<Id<'issues'>>();
  const projectIds = new Set<Id<'projects'>>();

  for (const entry of entries) {
    if (entry.issueId) issueIds.add(entry.issueId);
    if (entry.projectId) projectIds.add(entry.projectId);
  }

  const [issues, projects] = await Promise.all([
    Promise.all(Array.from(issueIds).map((id) => ctx.db.get('issues', id))),
    Promise.all(Array.from(projectIds).map((id) => ctx.db.get('projects', id))),
  ]);

  const issueTitleById = new Map<Id<'issues'>, string>();
  for (const issue of issues) {
    if (!issue) continue;
    issueTitleById.set(issue._id, issue.title);
  }

  const projectNameById = new Map<Id<'projects'>, string>();
  for (const project of projects) {
    if (!project) continue;
    projectNameById.set(project._id, project.name);
  }

  return entries.map((entry) => ({
    ...entry,
    issueTitle: entry.issueId ? issueTitleById.get(entry.issueId) ?? null : null,
    projectName: entry.projectId ? projectNameById.get(entry.projectId) ?? null : null,
  }));
}

export const finalizeFromDraft = zMutation({
  args: finalizeInvoiceFromDraftArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    if (args.periodEnd <= args.periodStart) {
      throw new ConvexError('Invalid invoice period');
    }

    await requireProjectForViewer(ctx, { projectId: args.projectId, viewerId });

    const entries: Array<Doc<'timeEntries'>> = [];
    for (const timeEntryId of args.timeEntryIds) {
      const entry = await ctx.db.get('timeEntries', timeEntryId);
      if (!entry) {
        throw new ConvexError('Some entries are no longer available; refresh the draft.');
      }
      if (entry.userId !== viewerId) {
        throw new ConvexError('Not authorized to invoice these entries.');
      }
      if (entry.projectId !== args.projectId) {
        throw new ConvexError('Some entries no longer match the selected project; refresh the draft.');
      }
      if (entry.endedAt === null) {
        throw new ConvexError('Some entries are still running; stop timers and refresh the draft.');
      }
      if (entry.invoiceId !== undefined && entry.invoiceId !== null) {
        throw new ConvexError('Some entries are already billed; refresh the draft.');
      }
      if (entry.startedAt < args.periodStart || entry.startedAt >= args.periodEnd) {
        throw new ConvexError('Some entries are outside the invoice period; refresh the draft.');
      }
      entries.push(entry);
    }

    const invoiceNumber = `INV-${formatDateYYYYMMDDUtc(now)}-${randomInvoiceSuffix()}`;
    const invoiceId = await ctx.db.insert('invoices', {
      invoiceNumber,
      creatorId: viewerId,
      projectId: args.projectId,
      status: 'saved',
      currency: args.currency,
      hourlyRateCents: args.hourlyRateCents,
      notes: args.notes?.trim() ? args.notes.trim() : null,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      paidAt: null,
      voidedAt: null,
    });

    for (const entry of entries) {
      await ctx.db.patch('timeEntries', entry._id, { invoiceId });
    }

    return invoiceId;
  },
});

export const updateInvoice = zMutation({
  args: updateInvoiceArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const now = Date.now();

    const existing = await ctx.db.get('invoices', args.invoiceId);
    if (!existing) {
      throw new ConvexError('Invoice not found');
    }
    if (existing.creatorId !== viewerId) {
      throw new ConvexError('Not authorized');
    }

    const patch: Partial<Doc<'invoices'>> = { updatedAt: now };

    if (args.status !== undefined && args.status !== existing.status) {
      patch.status = args.status;
      if (args.status === 'sent') patch.sentAt = now;
      if (args.status === 'paid') patch.paidAt = now;
      if (args.status === 'void') patch.voidedAt = now;
    }
    if (args.hourlyRateCents !== undefined) patch.hourlyRateCents = args.hourlyRateCents;
    if (args.notes !== undefined) patch.notes = args.notes?.trim() ? args.notes.trim() : null;

    await ctx.db.patch('invoices', args.invoiceId, patch);
    return args.invoiceId;
  },
});

export const listForViewer = zQuery({
  args: listInvoicesForViewerArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const limit = args.limit ?? 50;

    const base =
      args.status !== undefined
        ? await ctx.db
            .query('invoices')
            .withIndex('by_creator_status_created', (q) => q.eq('creatorId', viewerId).eq('status', args.status!))
            .order('desc')
            .take(Math.min(200, limit * 4))
        : await ctx.db
            .query('invoices')
            .withIndex('by_creator_created', (q) => q.eq('creatorId', viewerId))
            .order('desc')
            .take(Math.min(200, limit * 4));

    const filtered = args.projectId ? base.filter((inv) => inv.projectId === args.projectId) : base;
    return filtered.slice(0, limit);
  },
});

export const get = zQuery({
  args: getInvoiceArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);
    const invoice = await ctx.db.get('invoices', args.invoiceId);
    if (!invoice) return null;
    if (invoice.creatorId !== viewerId) {
      throw new ConvexError('Not authorized');
    }
    return invoice;
  },
});

export const listTimeEntriesForInvoice = zQuery({
  args: listTimeEntriesForInvoiceArgsSchema,
  handler: async (ctx, args) => {
    const viewerId = await requireViewerId(ctx);

    const invoice = await ctx.db.get('invoices', args.invoiceId);
    if (!invoice) {
      throw new ConvexError('Invoice not found');
    }
    if (invoice.creatorId !== viewerId) {
      throw new ConvexError('Not authorized');
    }

    const limit = args.limit ?? 200;
    const entries = await ctx.db
      .query('timeEntries')
      .withIndex('by_user_invoice_started', (q) => q.eq('userId', viewerId).eq('invoiceId', args.invoiceId))
      .order('asc')
      .take(limit);

    return await enrichTimeEntries(ctx, entries);
  },
});
