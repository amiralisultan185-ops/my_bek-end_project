const MANAGEMENT_ROLES = ['owner', 'director'];
const LEGAL_WORK_ROLES = ['senior_lawyer', 'lawyer'];
const ASSIGNABLE_CASE_ROLES = ['senior_lawyer', 'lawyer'];
const SUPPORT_ROLES = ['assistant', 'auditor'];
const STAFF_CREATION_ROLES = ['owner', 'senior_lawyer', 'lawyer', 'assistant', 'auditor'];
const INTERNAL_ROLES = ['owner', 'director', 'senior_lawyer', 'lawyer', 'assistant', 'auditor'];

const ROLE_PERMISSIONS = {
  owner: [
    'users:manage',
    'groups:manage',
    'inquiries:manage',
    'cases:read_all',
    'cases:assign',
    'cases:reassign',
    'cases:complete',
    'owner:create',
  ],
  director: [
    'users:manage',
    'groups:manage',
    'inquiries:manage',
    'cases:read_all',
    'cases:assign',
    'cases:reassign',
    'cases:complete',
  ],
  senior_lawyer: [
    'cases:read_assigned',
    'cases:work_assigned',
    'cases:submit_review',
  ],
  lawyer: [
    'cases:read_assigned',
    'cases:work_assigned',
    'cases:submit_review',
  ],
  assistant: [
    'cases:read_group',
    'cases:assist_group',
  ],
  auditor: [
    'cases:read_group',
  ],
};

function isManagementRole(role) {
  return MANAGEMENT_ROLES.includes(role);
}

function isLegalWorkRole(role) {
  return LEGAL_WORK_ROLES.includes(role);
}

function isAssignableCaseRole(role) {
  return ASSIGNABLE_CASE_ROLES.includes(role);
}

function isSupportRole(role) {
  return SUPPORT_ROLES.includes(role);
}

function roleHasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

module.exports = {
  MANAGEMENT_ROLES,
  LEGAL_WORK_ROLES,
  ASSIGNABLE_CASE_ROLES,
  SUPPORT_ROLES,
  STAFF_CREATION_ROLES,
  INTERNAL_ROLES,
  ROLE_PERMISSIONS,
  isManagementRole,
  isLegalWorkRole,
  isAssignableCaseRole,
  isSupportRole,
  roleHasPermission,
};
