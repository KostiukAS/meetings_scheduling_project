export const hasAllPermission = (permissions) => {
  if (!permissions) {
    return false;
  }

  return permissions
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .includes('all');
};
