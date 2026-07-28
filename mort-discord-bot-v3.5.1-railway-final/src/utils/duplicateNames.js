// Pure, dependency-free helper (no discord.js import) so it can be unit
// tested in isolation and reused anywhere command names need validating.
function findDuplicateNames(names) {
  const seen = new Set();
  const duplicates = new Set();
  for (const name of names) {
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  return [...duplicates];
}

module.exports = { findDuplicateNames };
