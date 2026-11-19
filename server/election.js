// Pure election rules, independently testable without a running database.
export function topTwo(venues, category, counts) {
  return venues.filter(venue => venue.category === category && venue.enabled)
    .sort((a, b) => ((counts[b.id] || 0) - (counts[a.id] || 0)) || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, 2).map(venue => venue.id);
}

export function eligibleForRound(venue, election) {
  if (!venue || !venue.enabled || election.phase !== 'open') return false;
  return election.round === 1 || (election.round === 2 && election.finalists?.[venue.category]?.includes(venue.id));
}
