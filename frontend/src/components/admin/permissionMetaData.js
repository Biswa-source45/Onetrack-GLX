/**
 * Comprehensive Metadata Dictionary for OneTrack Roles and Permissions.
 * Provides user-friendly titles, category groupings, and hover info descriptions.
 */

export const PERMISSION_CATEGORIES = {
  bid: {
    label: 'Tender Workspace',
    icon: 'FileText',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 border-blue-200 text-blue-700',
  },
  task: {
    label: 'Tasks & Checklists',
    icon: 'CheckSquare',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
  document: {
    label: 'Documents & Attachments',
    icon: 'Folder',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 border-amber-200 text-amber-700',
  },
  qualification: {
    label: 'Qualification & Eligibility',
    icon: 'ShieldCheck',
    color: 'text-violet-500',
    bgColor: 'bg-violet-50 border-violet-200 text-violet-700',
  },
  quotation: {
    label: 'Quotations & Pricing',
    icon: 'DollarSign',
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200 text-green-700',
  },
  costing: {
    label: 'Internal Costing',
    icon: 'Calculator',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 border-teal-200 text-teal-700',
  },
  user: {
    label: 'User Management',
    icon: 'Users',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  },
  workflow: {
    label: 'Stage Workflow',
    icon: 'GitPullRequest',
    color: 'text-rose-500',
    bgColor: 'bg-rose-50 border-rose-200 text-rose-700',
  },
  analytics: {
    label: 'Analytics & Reports',
    icon: 'BarChart',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-50 border-cyan-200 text-cyan-700',
  },
  notification: {
    label: 'Notifications',
    icon: 'Bell',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 border-purple-200 text-purple-700',
  },
  admin: {
    label: 'System Admin',
    icon: 'Key',
    color: 'text-red-500',
    bgColor: 'bg-red-50 border-red-200 text-red-700',
  },
}

export const PERMISSION_METADATA = {
  // Bid Permissions
  'bid.create': {
    label: 'Create Tender Workspace',
    category: 'bid',
    description: 'Allows creating new tender entries manually or via bulk excel upload.',
  },
  'bid.view': {
    label: 'View Tender Workspaces',
    category: 'bid',
    description: 'Allows viewing tender details, stages, metrics, and list dashboards.',
  },
  'bid.edit': {
    label: 'Edit Tender Specifications',
    category: 'bid',
    description: 'Allows editing tender meta details, dates, estimated values, and GeM bid numbers.',
  },
  'bid.delete': {
    label: 'Delete Tender Workspace',
    category: 'bid',
    description: 'Allows permanently removing tender workspaces from the system.',
  },
  'bid.assign': {
    label: 'Assign Bid Ownership',
    category: 'bid',
    description: 'Allows assigning or re-assigning Bid Owner and Technical Manager roles to tender workspaces.',
  },

  // Task Permissions
  'task.create': {
    label: 'Create Subtasks',
    category: 'task',
    description: 'Allows creating subtasks, checklist items, and assigning deadlines within tenders.',
  },
  'task.view': {
    label: 'View Tasks',
    category: 'task',
    description: 'Allows viewing task boards, Kanban columns, and checklist progress.',
  },
  'task.edit': {
    label: 'Edit Tasks',
    category: 'task',
    description: 'Allows updating task titles, descriptions, priorities, and deadlines.',
  },
  'task.assign': {
    label: 'Assign Tasks',
    category: 'task',
    description: 'Allows assigning tasks and compliance items to specific team members.',
  },
  'task.complete': {
    label: 'Complete Tasks',
    category: 'task',
    description: 'Allows marking checklist tasks as complete or verified.',
  },

  // Document Permissions
  'document.upload': {
    label: 'Upload Workspace Documents',
    category: 'document',
    description: 'Allows uploading tender PDFs, technical specs, OEM MAFs, and certificates.',
  },
  'document.view': {
    label: 'View & Download Documents',
    category: 'document',
    description: 'Allows viewing and downloading files attached to tenders and tasks.',
  },
  'document.delete': {
    label: 'Delete Workspace Documents',
    category: 'document',
    description: 'Allows deleting attached files and uploaded documents from tender workspaces.',
  },

  // Qualification Permissions
  'qualification.view': {
    label: 'View Qualification Results',
    category: 'qualification',
    description: 'Allows inspecting eligibility criteria and compliance evaluation status.',
  },
  'qualification.override': {
    label: 'Override Qualification Status',
    category: 'qualification',
    description: 'Allows manually overriding compliance check results or flagging exceptions.',
  },
  'qualification.approve': {
    label: 'Approve Qualification',
    category: 'qualification',
    description: 'Allows giving formal approval for technical and commercial eligibility.',
  },

  // Quotation Permissions
  'quotation.create': {
    label: 'Create Commercial Quotations',
    category: 'quotation',
    description: 'Allows initiating draft quotation sheets and entering unit prices.',
  },
  'quotation.view': {
    label: 'View Quotations & Pricing',
    category: 'quotation',
    description: 'Allows viewing commercial bid details, price schedules, and margins.',
  },
  'quotation.edit': {
    label: 'Edit Commercial Quotation',
    category: 'quotation',
    description: 'Allows modifying quotation line items, discounts, and terms.',
  },
  'quotation.approve': {
    label: 'Approve Quotation',
    category: 'quotation',
    description: 'Allows commercial managers to approve pricing before submission.',
  },
  'quotation.lock': {
    label: 'Lock Final Quotation',
    category: 'quotation',
    description: 'Allows locking final quotation figures to prevent modifications after submission.',
  },

  // Costing Permissions
  'costing.view': {
    label: 'View Internal Costing',
    category: 'costing',
    description: 'Allows viewing internal cost sheets, OEM margins, and overhead calculations.',
  },
  'costing.edit': {
    label: 'Edit Internal Costing',
    category: 'costing',
    description: 'Allows editing cost estimates, margin rules, and vendor quote calculations.',
  },

  // User Management Permissions
  'user.create': {
    label: 'Create System Users',
    category: 'user',
    description: 'Allows creating new user accounts, employee codes, and initial credentials.',
  },
  'user.view': {
    label: 'View User Directory',
    category: 'user',
    description: 'Allows loading system user lists, profiles, and directory dropdowns for assignments.',
  },
  'user.edit': {
    label: 'Edit User Profiles',
    category: 'user',
    description: 'Allows updating user profile details, email, phone, and department.',
  },
  'user.deactivate': {
    label: 'Deactivate / Activate Accounts',
    category: 'user',
    description: 'Allows toggling active status to disable or restore user login access.',
  },
  'user.assign_role': {
    label: 'Assign Roles & Permissions',
    category: 'user',
    description: 'Allows assigning system roles (e.g. Bid Manager) and permission overrides to users.',
  },

  // Workflow Permissions
  'workflow.transition': {
    label: 'Transition Workflow Stages',
    category: 'workflow',
    description: 'Allows advancing tenders across workflow stages (e.g., Qualification -> Submitted).',
  },
  'workflow.override': {
    label: 'Override Workflow Stage Guards',
    category: 'workflow',
    description: 'Allows forcing stage transitions when checklist items or checks are incomplete.',
  },

  // Notification Permissions
  'notification.view': {
    label: 'View In-App Notifications',
    category: 'notification',
    description: 'Allows receiving and viewing real-time alerts for tender updates.',
  },
  'notification.manage': {
    label: 'Manage Alert Settings',
    category: 'notification',
    description: 'Allows configuring system notification preferences and alert triggers.',
  },

  // Analytics Permissions
  'analytics.view': {
    label: 'View Analytics Dashboards',
    category: 'analytics',
    description: 'Allows viewing win/loss rates, bid pipeline funnel, and revenue trends.',
  },
  'analytics.export': {
    label: 'Export Analytics Reports',
    category: 'analytics',
    description: 'Allows exporting performance reports and tender data to PDF or Excel format.',
  },

  // System Admin Permission
  'admin.system': {
    label: 'Full System Administration',
    category: 'admin',
    description: 'Grants unrestricted administrative access to all features, settings, and database operations.',
  },
}

export const ROLE_DETAILS = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    badgeVariant: 'destructive',
    description: 'Full system administration privileges. Can manage all settings, reset passwords, assign roles, and access all endpoints.',
    summary: 'Unrestricted Access'
  },
  ADMIN: {
    label: 'Admin',
    badgeVariant: 'default',
    description: 'Administrative access for user provisioning, role assignments, user status management, and full bid pipeline management.',
    summary: 'User & System Administration'
  },
  BID_MANAGER: {
    label: 'Bid Manager',
    badgeVariant: 'secondary',
    description: 'Manages the complete tender lifecycle. Can create bids, assign Bid Owners, manage team tasks, and transition stages.',
    summary: 'Full Bid Lifecycle & Pipeline'
  },
  BID_OWNER: {
    label: 'Bid Owner',
    badgeVariant: 'outline',
    description: 'Owns specific assigned tenders. Responsible for execution, task creation, document uploads, and compliance checklists.',
    summary: 'Tender Execution Lead'
  },
  REVIEWER: {
    label: 'Reviewer',
    badgeVariant: 'outline',
    description: 'Validates technical specs, past experience compliance, and provides technical qualification approvals.',
    summary: 'Compliance & Technical Verification'
  },
  FINANCE: {
    label: 'Finance',
    badgeVariant: 'outline',
    description: 'Handles EMD deposits, Bank Guarantees (BG), margin calculations, cost sheets, and commercial quotations.',
    summary: 'EMD, Costing & Commercials'
  },
  MANAGEMENT: {
    label: 'Management',
    badgeVariant: 'outline',
    description: 'Executive oversight. Has read access everywhere, approves final commercial quotes, and reviews analytics dashboards.',
    summary: 'Executive Oversight & Final Approval'
  },
  OPERATOR: {
    label: 'Operator',
    badgeVariant: 'outline',
    description: 'Day-to-day operational execution. Uploads documents, checks off compliance tasks, and logs portal submission details.',
    summary: 'Portal Submission & Execution'
  },
}
