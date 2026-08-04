// Converts ledger values such as "2604000949 MR. Ar Shailesh Gupta - MR-10/Bapat"
// into the concise UI display name: "Shailesh Gupta".
export const formatArchitectDisplayName = (value) => {
  if (!value) return '';

  let name = String(value).trim();
  if (name.includes('|')) name = name.split('|').pop().trim();

  name = name
    .replace(/^\d+\s*[-|:]?\s*/, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/^(?:(?:mr\.?|mrs\.?|ms\.?|dr\.?|ar)\s+)+/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();

  const words = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

  return words.length > 2 ? `${words[0]} ${words[words.length - 1]}` : words.join(' ');
};
