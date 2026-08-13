/**
 * Comprehensive Metadata Dictionary for OneTrack Roles and Permissions (V2 Architecture).
 * Provides user-friendly titles, category groupings, and hover info descriptions.
 */

export const PERMISSION_CATEGORIES = {
  bid: {
    label: 'Tender Workspace',
    icon: 'FileText',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300',
  },
  task: {
    label: 'Tasks & Checklists',
    icon: 'CheckSquare',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
  },
  document: {
    label: 'Documents & Attachments',
    icon: 'Folder',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300',
  },
  user: {
    label: 'User Management',
    icon: 'Users',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300',
  },
  analytics: {
    label: 'Analytics & Reports',
    icon: 'BarChart',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-950/40 dark:border-cyan-800 dark:text-cyan-300',
  },
  notification: {
    label: 'Notifications & Alerts',
    icon: 'Bell',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300',
  },
  admin: {
    label: 'System Admin',
    icon: 'Key',
    color: 'text-red-500',
    bgColor: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300',
  },
}

export const PERMISSION_METADATA = {
  // Bid / Tender Workspace Permissions
  'bid.create': {
    label: 'Create Tender Workspace',
    category: 'bid',
    description: 'Allows creating new tender entries manually or via bulk excel upload.',
  },
  'bid.view': {
    label: 'View Tender Workspaces',
    category: 'bid',
    description: 'Allows viewing tender details, stage workspaces, metrics, and spreadsheets.',
  },
  'bid.edit': {
    label: 'Edit Tender Specifications',
    category: 'bid',
    description: 'Allows editing tender meta details, dates, estimated values, and stage data.',
  },
  'bid.delete': {
    label: 'Delete Tender Workspace',
    category: 'bid',
    description: 'Allows soft-deleting tender workspaces to the bin and purging them.',
  },
  'bid.assign': {
    label: 'Assign Bid Ownership',
    category: 'bid',
    description: 'Allows assigning or re-assigning Bid Owner and Technical Lead to tender workspaces.',
  },

  // Task Permissions
  'task.create': {
    label: 'Create Checklist Tasks',
    category: 'task',
    description: 'Allows creating subtasks, stage checklist items, and assigning deadlines.',
  },
  'task.view': {
    label: 'View Tasks & Checklists',
    category: 'task',
    description: 'Allows viewing task boards, stage checklists, and compliance items.',
  },
  'task.edit': {
    label: 'Edit Tasks',
    category: 'task',
    description: 'Allows updating task titles, descriptions, priorities, and deadlines.',
  },
  'task.assign': {
    label: 'Assign Tasks',
    category: 'task',
    description: 'Allows assigning checklist tasks and compliance items to specific team members.',
  },
  'task.complete': {
    label: 'Complete Checklist Tasks',
    category: 'task',
    description: 'Allows marking checklist tasks as completed or verified.',
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
    description: 'Allows assigning system roles and permission overrides to users.',
  },

  // Analytics Permissions
  'analytics.view': {
    label: 'View Analytics Dashboards',
    category: 'analytics',
    description: 'Allows viewing win/loss rates, bid pipeline funnel, 3D charts, and performance matrices.',
  },
  'analytics.export': {
    label: 'Export Analytics Reports',
    category: 'analytics',
    description: 'Allows exporting performance reports and tender data to Excel or PDF format.',
  },

  // Notification Permissions
  'notification.view': {
    label: 'View In-App Notifications',
    category: 'notification',
    description: 'Allows receiving and viewing real-time alerts and system notifications.',
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
    description: 'Full unrestricted system administration privileges. Can manage all settings, reset passwords, assign roles, and access all endpoints.',
    summary: 'Unrestricted System Access'
  },
  ADMIN: {
    label: 'Admin',
    badgeVariant: 'default',
    description: 'Administrative access for user provisioning, role assignments, user status management, and full bid pipeline management.',
    summary: 'User & System Administration'
  },
  MANAGER: {
    label: 'Manager',
    badgeVariant: 'secondary',
    description: 'Manages the complete tender lifecycle. Can create tenders, assign Bid Owners, manage team tasks, and review analytics.',
    summary: 'Full Bid Lifecycle & Pipeline Lead'
  },
  BID_EXECUTIVE: {
    label: 'Bid Executive',
    badgeVariant: 'outline',
    description: 'Responsible for tender discovery, stage-by-stage execution, document uploads, and compliance checklists.',
    summary: 'Tender Execution Lead'
  },
  PRE_SALES: {
    label: 'Pre-Sales',
    badgeVariant: 'outline',
    description: 'Conducts technical eligibility evaluation, OEM tracking, and pre-sales feasibility assessments.',
    summary: 'Technical & Pre-Sales Assessment'
  },
  FINANCE: {
    label: 'Finance',
    badgeVariant: 'outline',
    description: 'Handles EMD deposits, Bank Guarantees (BG), margin calculations, cost sheets, and commercial pricing.',
    summary: 'EMD, Costing & Financial Operations'
  },
}
